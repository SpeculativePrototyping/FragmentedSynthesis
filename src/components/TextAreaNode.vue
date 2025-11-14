<script setup lang="ts">
import {ref, watch, computed, inject, nextTick} from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import type { NodeProps } from '@vue-flow/core'
import { enqueueLlmJob } from '../api/llmQueue'


type SummaryStatus = 'idle' | 'queued' | 'processing' | 'done' | 'error'

interface BibEntry {
  id: string
  type: string
  fields: Record<string, string>
}

interface TextNodeData {
  value?: string
  label?: string
  placeholder?: string
  citations?: string[]
  status?: SummaryStatus
  error?: string | null
}

interface TextNodeProps extends NodeProps<TextNodeData> {
  bibliography: BibEntry[]           // zentrale Bibliographie
  updateBibliography?: (newBib: BibEntry[]) => void
}

const props = defineProps<TextNodeProps>()
const { updateNodeData, nodes, edges } = useVueFlow()
const isCompact = ref(false)
const text = ref<string>(String(props.data?.value ?? ''))
const summary = ref("")
const status = ref<SummaryStatus>((props.data?.status as SummaryStatus) ?? 'idle')
const availableSources = computed(() => props.bibliography ?? [])
const TLDR = inject('TLDR')
const textAreaRef = ref<HTMLTextAreaElement | null>(null)
const cursorPos = ref<{ start: number; end: number }>({ start: 0, end: 0 })
const searchQuery = ref('')
const showSearch = ref(false)

const filteredSources = computed(() => {
  if (!searchQuery.value) return availableSources.value
  const query = searchQuery.value.toLowerCase()
  return availableSources.value.filter(entry =>
      (entry.fields.author ?? '').toLowerCase().includes(query) ||
      (entry.fields.title ?? '').toLowerCase().includes(query) ||
      entry.id.toLowerCase().includes(query)
  )
})


const statusLabel = computed(() => {
  switch (status.value) {
    case 'queued':
      return 'Status: queued…'
    case 'processing':
      return 'Status: processing…'
    case 'done':
      return 'Status: done'
    case 'error':
      return 'Status: error'
    default:
      return 'Status: idle'
  }
})


const NODE_PROMPT = `You are a concise academic assistant. Summarize the user's text in 1 extremely short sentence.
Output only LaTeX-safe prose (no environments), suitable for inclusion in a paragraph.
Respond strictly with JSON containing a single string property named 'summary'.`

const RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'summary_response',
    schema: {
      type: 'object',
      properties: { summary: { type: 'string' } },
      required: ['summary'],
      additionalProperties: false,
    },
  },
} as const

let requestToken = 0;

async function generateSummary() {
  const txt = text.value.trim()
  if (!txt) {
    summary.value = ''
    status.value = 'idle'
    return
  }

  const token = ++requestToken
  summary.value = ''
  status.value ="queued"

  try {
    const result = await enqueueLlmJob({
      sys: NODE_PROMPT,
      user: txt,
      responseFormat: RESPONSE_FORMAT,
      onStart: () => {},
    })

    if (token !== requestToken) return

    const msg = result.message || ''
    const parsed = (() => {
      try { return JSON.parse(msg) } catch { return null }
    })()

    summary.value = parsed?.summary?.trim() ?? msg.trim()
    status.value = "done"
  } catch {
    summary.value = ''
    status.value = "error"
  }
}

function addCitationByKey(key: string) {
  const textarea = textAreaRef.value
  const citationText = `~\\cite{${key}}`
  const { start, end } = cursorPos.value

  // Falls keine gespeicherte Position -> an Ende anhängen
  if (!textarea || start === undefined) {
    text.value += citationText
  } else {
    const before = text.value.slice(0, start)
    const after = text.value.slice(end)
    text.value = before + citationText + after
    // Cursorposition aktualisieren
    nextTick(() => {
      textarea.focus()
      textarea.selectionStart = textarea.selectionEnd = start + citationText.length
    })
  }

  // Citations-Array aktualisieren
  const citations = props.data.citations ? [...props.data.citations] : []
  if (!citations.includes(key)) {
    citations.push(key)
    updateNodeData(props.id, { ...props.data, citations })
  }

  searchQuery.value = ''
  showSearch.value = false
}



function removeCitation(key: string) {
  // 1️⃣ Aktualisiere das citations-Array
  const citations = props.data.citations ? [...props.data.citations] : []
  const newCitations = citations.filter(c => c !== key)

  // 2️⃣ Entferne alle ~\cite{key} aus dem Text
  const regex = new RegExp(`~\\\\cite\\{${key}\\}`, 'g')
  const newText = text.value.replace(regex, '')

  // Optional: überflüssige Leerzeichen bereinigen
  text.value = newText.replace(/\s{2,}/g, ' ').trim()

  // 3️⃣ Update Node-Daten
  updateNodeData(props.id, { ...props.data, citations: newCitations, value: text.value })
}


function updateCursorPosition() {
  const el = textAreaRef.value
  if (el) {
    cursorPos.value = {
      start: el.selectionStart,
      end: el.selectionEnd,
    }
  }
}

function reinsertCitation(key: string) {
  const textarea = textAreaRef.value
  const citationText = `~\\cite{${key}}`
  const { start, end } = cursorPos.value

  if (!textarea || start === undefined) {
    text.value += citationText
  } else {
    const before = text.value.slice(0, start)
    const after = text.value.slice(end)
    text.value = before + citationText + after

    // Cursor nach dem eingefügten Zitat positionieren
    nextTick(() => {
      textarea.focus()
      textarea.selectionStart = textarea.selectionEnd = start + citationText.length
    })
  }
  updateNodeData(props.id, { ...props.data, value: text.value })
}


// --- Watchers ---
watch(isCompact, v => {
  if (v) generateSummary()
})

watch(isCompact, v => {
  if (!v) status.value = "idle"
})

watch(
    () => props.bibliography,
    (newBib) => {
      if (!props.data.citations) return;

      const invalidCitations = props.data.citations.filter(
          key => !newBib.some(entry => entry.id === key)
      );

      // Alle ungültigen Zitate entfernen
      invalidCitations.forEach(key => removeCitation(key));
    },
    { deep: true }
);

watch(TLDR, (val) => {
  if (typeof val === 'boolean') {
    isCompact.value = val
  }
})


// Debounced push to Vue Flow state so downstream nodes can read `data.value`
let timer: number | undefined
watch(text, (v) => {
  window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    updateNodeData(props.id, { ...props.data, value: v })
  }, 150)
})


</script>

<template>
  <div class="text-node doc-node node-wrapper" >

    <div class="node-hover-toggle">
      <label class="toggle-switch" title="Shrinks the node and shows a short summary of your input for better visibility.">
        <input type="checkbox" v-model="isCompact"/>
        <span class="slider"></span>
      </label>
      <span
          class="toggle-label"
          title="Shrinks the node and shows a short summary of your input for better visibility.">
            TLDR
          </span>
    </div>

    <header class="doc-node__header">
      <strong>{{ props.data?.label ?? 'Text' }}</strong>
      <span class="doc-node__hint">{{ statusLabel }}</span>
    </header>

    <section class="doc-node__body">
      <textarea
          ref="textAreaRef"
          v-if="!isCompact"
          v-model="text"
          @wheel.stop
          rows="6"
          class="text-node__textarea"
          :placeholder="props.data?.placeholder ?? 'This node is for text input. Type here and connect it to other nodes...'"
          spellcheck="true"
          autocapitalize="sentences"
          autocomplete="on"
          data-gramm="true"
          data-gramm_editor="true"
          aria-label="Text node editor"
          @select="updateCursorPosition"
          @keyup="updateCursorPosition"
          @click="updateCursorPosition"
      />

      <div v-else class="compact-summary">
        {{ summary }}
      </div>

      <div v-if="!isCompact" class="citations-ui">
        <div class="selected-citations">
<span
    v-for="key in props.data.citations ?? []"
    :key="key"
    class="citation-tag"
>
  <span @click="reinsertCitation(key)" style="cursor: pointer;">
    {{ key }}
  </span>
  <button @click="removeCitation(key)">×</button>
</span>

        </div>
        <button @click="showSearch = !showSearch" class="citation-add-btn">
          + Add New Reference
        </button>
        <div v-if="showSearch" class="citation-search">
          <input
              v-model="searchQuery"
              class="citation-search-input"
              placeholder="Search references..."
          />
          <ul class="citation-search-list" @wheel.stop>
            <li v-for="entry in filteredSources" :key="entry.id" @click="addCitationByKey(entry.id)">
              <span class="key">{{ entry.id }}</span>
            </li>
          </ul>
        </div>
      </div>
    </section>
    <Handle id="output" type="source" :position="Position.Right" />
  </div>
</template>


<style scoped>

.text-node {
  overflow: visible;
}

.node-wrapper {
  display: flex;
  overflow: hidden;
  flex-direction: column;
  resize: none;
  min-height: 0;
  width: 650px;
  height: 100%;
}

.doc-node__body {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.text-node__textarea {
  width: 600px;
  margin: 0 auto;
  min-height: 100px;
  height: 100px;
  padding: 10px 12px;
  border: 1px solid rgba(15,23,42,.15);
  border-radius: 10px;
  background: #fff;
  font: inherit;
  line-height: 1.45;
  resize: vertical;
}

.text-node__textarea:focus {
  outline: 2px solid rgba(99,102,241,.45);
  border-color: rgba(99,102,241,.45);
}

.compact-summary {
  width: 600px;
  max-height: 240px;
  padding: 10px 12px;
  border: 1px solid rgba(15,23,42,.15);
  border-radius: 10px;
  background: #fff;
  font: inherit;
  font-size: x-small;
  line-height: 1.00;
  overflow: auto;
}

.node-hover-toggle {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}

.node-wrapper:hover .node-hover-toggle {
  opacity: 1;
  pointer-events: auto;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 28px;
  height: 16px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-switch .slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  border-radius: 12px;
  transition: 0.2s;
}

.toggle-switch .slider::before {
  content: "";
  position: absolute;
  height: 12px;
  width: 12px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  border-radius: 50%;
  transition: 0.2s;
}

.toggle-switch input:checked + .slider {
  background-color: #22ff00;
}

.toggle-switch input:checked + .slider::before {
  transform: translateX(12px);
}

.toggle-label {
  font-size: 0.75rem;
  color: #000;
}

.citation-item input {
  padding: 10px 12px;
  border: 1px solid rgba(15,23,42,.15);
  border-radius: 10px;
  background: #fff;
  font: inherit;
  width: 100%;
}

.citation-item input:focus {
  outline: 2px solid rgba(99,102,241,.45);
  border-color: rgba(99,102,241,.45);
}

.citation-item button {
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(15,23,42,.15);
  background: #f7f7f7;
  cursor: pointer;
}

.citation-item button:hover {
  background: #eee;
}

.citations-ui {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;

  box-sizing: border-box;
  margin: 0 auto;
}

.selected-citations {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.citation-tag {
  background: #e0e7ff;
  padding: 4px 8px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.citation-tag button {
  border: none;
  background: transparent;
  cursor: pointer;
}

.citation-add-btn {
  width: 100%;
  border-radius: 10px;
  border: 1px solid #ccc;
  background: #f7f7f7;
  padding: 8px;
  cursor: pointer;

}

.citation-add-btn:hover {
  background: #eee;
}

.citation-search-input {
  width: 100%;
  height: 35px;
  padding: 8px;
  border-radius: 6px;
  border: 1px solid rgba(15,23,42,.15);
  margin-bottom: 8px;
  box-sizing: border-box;
}

.citation-search-list {
  max-height: 160px;
  min-height: 35px;
  overflow-y: auto;
  background: #fff;
  border: 1px solid rgba(15,23,42,.15);
  border-radius: 6px;
  padding: 4px;
  box-sizing: border-box;
}

.citation-search-list li {
  display: flex;
  flex-direction: row;
  gap: 6px;
  width: 100%;
  cursor: pointer;
  padding: 6px;
  box-sizing: border-box;
}

.citation-search-list li:hover {
  background: #eee;
}

.citation-search-list li span.key {
  font-weight: bold;
  flex-shrink: 0;
}

.citation-search-list li span.title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}


</style>