<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import type { NodeProps } from '@vue-flow/core'
import { enqueueLlmJob } from '../api/llmQueue'

type SummaryStatus = 'idle' | 'queued' | 'processing' | 'done' | 'error'


interface TextNodeData {
  value?: string
  label?: string
  placeholder?: string
  citations?: string[]
  status?: SummaryStatus
  error?: string | null
}


const props = defineProps<NodeProps<TextNodeData>>()
const { updateNodeData, nodes, edges } = useVueFlow()
const isCompact = ref(false)
const text = ref<string>(String(props.data?.value ?? ''))
const summary = ref("")
const status = ref<SummaryStatus>((props.data?.status as SummaryStatus) ?? 'idle')


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

// --- Watchers ---
watch(isCompact, v => {
  if (v) generateSummary()
})

watch(isCompact, v => {
  if (!v) status.value = "idle"
})


// Debounced push to Vue Flow state so downstream nodes can read `data.value`
let timer: number | undefined
watch(text, (v) => {
  window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    updateNodeData(props.id, { ...props.data, value: v })
  }, 150)
})

// --- Citation Functions ---
function addCitation() {
  const citations = props.data.citations ? [...props.data.citations] : []
  citations.push('')
  updateNodeData(props.id, { ...props.data, citations })
}

function removeCitation(index: number) {
  const citations = props.data.citations ? [...props.data.citations] : []
  citations.splice(index, 1)
  updateNodeData(props.id, { ...props.data, citations })
}

function updateCitation(index: number, value: string) {
  const citations = props.data.citations ? [...props.data.citations] : []
  citations[index] = value
  updateNodeData(props.id, { ...props.data, citations })
}


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
      />

      <div v-else class="compact-summary">
        {{ summary }}
      </div>
    </section>

    <!-- Citations -->
    <div v-if="!isCompact" class="text-node__citations">
      <div v-for="(c, i) in props.data.citations ?? []" :key="i" class="citation-item">
        <input type="text":value="c" @input="e => updateCitation(i, e.target.value)" />
        <button type="button" @click="removeCitation(i)">❌</button>
      </div>
    </div>

    <div v-if="!isCompact" class="add-wrapper">
    <button type="button" class="add" @click="addCitation">+ Add Source (APA)</button>
    </div>

    <Handle id="output" type="source" :position="Position.Right" />
  </div>
</template>

<style scoped>
.text-node { overflow: visible; }

.node-wrapper {
  position: relative;
}

.text-node__textarea {
  min-width: 400px;
  min-height: 240px;
  padding: 10px 12px;
  border: 1px solid rgba(15,23,42,.15);
  border-radius: 10px;
  background: #fff;
  font: inherit;
  line-height: 1.45;
  resize: both;
}

.text-node__textarea:focus {
  outline: 2px solid rgba(99,102,241,.45);
  border-color: rgba(99,102,241,.45);
}

.compact-summary {
  width: 400px;
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

.text-node__citations {
  padding: 10px 12px;
  border-radius: 10px;
}

.citation-item {
  display: flex;
  align-items: center;
  gap: 8px; /* Abstand zwischen Input und Button */
  margin-bottom: 6px;
  width: 100%; /* volle Breite wie das darüber liegende Element */
}

.citation-item input {
  flex: 1; /* Input nimmt den verbleibenden Platz ein */
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
  flex: 0 0 auto; /* Button behält seine natürliche Breite */
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(15,23,42,.15);
  background: #f7f7f7;
  cursor: pointer;
}

.citation-item button:hover {
  background: #eee;
}

.add-wrapper {
  padding: 10px 12px;
  border-radius: 10px;
}

.add {
  width: 100%;
  height: 50px;
  margin-top: 6px;
  border-radius: 10px;
  border: 1px solid #ccc;
  background: #f7f7f7;
  cursor: pointer;
}

.add:hover {
  background: #eee;
}

</style>