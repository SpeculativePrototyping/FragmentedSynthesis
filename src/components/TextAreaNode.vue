<script setup lang="ts">
import {ref, watch, computed, inject, nextTick, onMounted, onBeforeUnmount} from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import type { NodeProps } from '@vue-flow/core'
import { enqueueLlmJob } from '../api/llmQueue'
import { NodeToolbar } from '@vue-flow/node-toolbar'
import type { Ref } from 'vue'
import { textNodePrompts } from '@/nodes/prompts'





type SummaryStatus = 'idle' | 'queued' | 'processing' | 'done' | 'error'

interface BibEntry {
  id: string
  type: string
  fields: Record<string, string>
}

interface ImageCacheEntry {
  base64: string
  refLabel: string
}
type ImageCache = Record<string, ImageCacheEntry>

const imageCache = inject<Ref<ImageCache>>('imageCache')!

interface TextNodeData {
  value?: string
  label?: string
  placeholder?: string
  citations?: string[]
  figures?: string[]
  status?: SummaryStatus
  error?: string | null
  width?: number
  height?: number
}

interface TextNodeProps extends NodeProps<TextNodeData> {

}

const bibliography = inject<Ref<BibEntry[]>>('bibliography')!
const props = defineProps<TextNodeProps>()
const { updateNodeData, nodes, edges } = useVueFlow()
const isCompact = ref(false)
const text = ref<string>(String(props.data?.value ?? ''))
const summary = ref("")
const status = ref<SummaryStatus>((props.data?.status as SummaryStatus) ?? 'idle')
const availableSources = computed(() => bibliography.value)
const TLDR = inject('TLDR')
const textAreaRef = ref<HTMLTextAreaElement | null>(null)
const cursorPos = ref<{ start: number; end: number }>({ start: 0, end: 0 })
const searchQuery = ref('')
const showSearch = ref(false)
const COMPLETE_CITATION_REGEX = /~\\cite\{([^\}]+)\}(?=\s|$)/g;
const nodeRef = ref<HTMLElement | null>(null)
let resizeObs: ResizeObserver | null = null
let resizeRaf: number | null = null
const language = inject<Ref<'en' | 'de'>>('language')!


const filteredSources = computed(() => {
  if (!searchQuery.value) return availableSources.value
  const query = searchQuery.value.toLowerCase()
  return availableSources.value.filter(entry =>
      (entry.fields.author ?? '').toLowerCase().includes(query) ||
      (entry.fields.title ?? '').toLowerCase().includes(query) ||
      entry.id.toLowerCase().includes(query)
  )
})

const invalidCitations = computed(() => {
  if (!props.data?.citations) return new Set<string>();
  const bibKeys = new Set(bibliography.value.map(entry => entry.id));
  return new Set(props.data.citations.filter(key => !bibKeys.has(key)));
});


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
  status.value = "queued"

  // Hier holen wir dynamisch die Prompts
  const { basePrompt, responseFormat } = getPrompts()

  try {
    const result = await enqueueLlmJob({
      sys: basePrompt,
      user: txt,
      responseFormat,
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

function getPrompts() {
  return textNodePrompts[language.value]
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

onMounted(() => {
  if (!nodeRef.value) return

  resizeObs = new ResizeObserver(entries => {
    const box = entries[0].contentRect
    const width = Math.round(box.width)
    const height = Math.round(box.height)

    if (resizeRaf) cancelAnimationFrame(resizeRaf)

    resizeRaf = requestAnimationFrame(() => {
      if (
          props.data?.width === width &&
          props.data?.height === height
      ) return

      updateNodeData(props.id, {
        ...(props.data ?? {}),
        width,
        height,
      })
    })
  })

  resizeObs.observe(nodeRef.value)
})

onBeforeUnmount(() => {
  if (resizeObs && nodeRef.value) {
    resizeObs.unobserve(nodeRef.value)
  }
  resizeObs = null

  if (resizeRaf) cancelAnimationFrame(resizeRaf)
})



// --- Watchers ---
watch(isCompact, v => {
  if (v) generateSummary()
})

watch(isCompact, v => {
  if (!v) status.value = "idle"
})

watch(bibliography, (newBib) => {
  if (!props.data.citations) return;

  const invalidCitations = props.data.citations.filter(
      key => !newBib.some(entry => entry.id === key)
  );

  // Alle ungültigen Zitate entfernen
  invalidCitations.forEach(key => removeCitation(key));
}, { deep: true })


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


let citationTimer: number | undefined;

watch(text, (currentText) => {
  window.clearTimeout(citationTimer);
  citationTimer = window.setTimeout(() => {
    if (!props.data) return;

    const foundCitations = new Set<string>();
    const matches = currentText.matchAll(COMPLETE_CITATION_REGEX);

    for (const match of matches) {
      const key = match[1].trim();
      if (key) foundCitations.add(key);
    }

    updateNodeData(props.id, {
      ...props.data,
      citations: Array.from(foundCitations),
    });
  }, 5000);
});



let figureTimer: number | undefined;

watch(text, (currentText) => {
  window.clearTimeout(figureTimer);
  figureTimer = window.setTimeout(() => {
    const found = new Set<string>();

    for (const [imageName, img] of Object.entries(imageCache.value)) {
      const label = img.refLabel;
      if (!label) continue;

      const regex = new RegExp(`~\\\\autoref\\{${label}\\}`, 'g');
      if (regex.test(currentText)) {
        found.add(imageName);
      }
    }

    updateNodeData(props.id, {
      ...props.data,
      figures: [...found],
    });
  }, 5000); // z.B. gleiche 5 Sekunden wie bei citations
});


// Füge neue Figure-Referenz an Cursor ein
function addFigureReferenceByKey(imageName: string) {
  const img = imageCache.value[imageName]
  if (!img) return

  const label = img.refLabel
  const insertText = `~\\autoref{${label}}`

  const textarea = textAreaRef.value
  const { start, end } = cursorPos.value

  if (!textarea || start == null) {
    text.value += insertText
  } else {
    text.value =
        text.value.slice(0, start) +
        insertText +
        text.value.slice(end)

    nextTick(() => {
      textarea.selectionStart = textarea.selectionEnd = start + insertText.length
      textarea.focus()
    })
  }

  // Figures speichern als imageName (intern eindeutig)
  const figs = new Set(props.data.figures ?? [])
  figs.add(imageName)

  updateNodeData(props.id, { ...props.data, figures: [...figs] })
}


// Entfernt Tag UND alle Vorkommen im Text
function removeFigureReference(imageName: string) {
  const img = imageCache.value[imageName]
  if (!img) return

  const label = img.refLabel

  // Entfernen im Text
  const regex = new RegExp(`~\\\\autoref\\{${label}\\}`, 'g')
  text.value = text.value.replace(regex, '').replace(/\s{2,}/g, ' ').trim()

  // Entfernen aus Liste
  const figs = (props.data.figures ?? []).filter(f => f !== imageName)

  updateNodeData(props.id, {
    ...props.data,
    figures: figs,
    value: text.value,
  })
}


// Beim Klick auf gelben Tag erneut einfügen
function reinsertFigureReference(key: string) {
  addFigureReferenceByKey(key)
}

// Für Suchliste
const searchFigureQuery = ref('')
const showFigureSearch = ref(false)

const filteredFigures = computed(() => {
  const q = searchFigureQuery.value.toLowerCase()
  if (!q) return Object.entries(imageCache.value)

  return Object.entries(imageCache.value).filter(([key, img]) =>
      img.refLabel.toLowerCase().includes(q)
  )
})

watch(language, () => {
  if (status.value === 'done') {
    generateSummary()
  }
})



</script>

<template>

  <NodeToolbar>
    <div class="toolbar-buttons">
      <label class="toggle-switch" title="Show a short summary (TLDR).">
        <input type="checkbox" v-model="isCompact" />
        <span class="slider"></span>
      </label>
      <span class="toggle-label">TLDR</span>
    </div>
  </NodeToolbar>

  <div class="text-node doc-node node-wrapper" ref="nodeRef">
    <header class="doc-node__header">
      <strong :class="{ 'compact-summary-text': isCompact }">
        {{ isCompact ? (summary || 'Text Input Node') : (props.data?.label ?? 'Text Node') }}
      </strong>
      <span class="doc-node__hint" v-if="!isCompact">{{ statusLabel }}</span>
    </header>

    <section class="doc-node__body" v-if="!isCompact">
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
    :class="{ 'citation-unknown': invalidCitations.has(key) }"
>
  <span @click="reinsertCitation(key)" style="cursor: pointer;">
    {{ key }}
  </span>
  <button @click="removeCitation(key)">×</button>
</span>


        </div>

        <div class="selected-citations">
    <span
        v-for="key in props.data.figures ?? []"
        :key="key"
        class="figure-tag"
        @click="reinsertFigureReference(key)"
    >
      {{ imageCache[key].refLabel }}
      <button class="remove-btn" @click.stop="removeFigureReference(key)">×</button>
    </span>
        </div>

        <button @click="showSearch = !showSearch" class="citation-add-btn">
          + Add New Citation
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

      <div v-if="!isCompact" class="figures-ui">
        <!-- BUTTON -->
        <button class="citation-add-btn" @click="showFigureSearch = !showFigureSearch">
          + Add Figure Reference
        </button>

        <!-- SEARCH DROPDOWN -->
        <div v-if="showFigureSearch" class="citation-search">
          <input
              v-model="searchFigureQuery"
              placeholder="Search figures..."
              class="citation-search-input"
          />

          <ul class="citation-search-list" @wheel.stop>
            <li
                v-for="([key, img]) in filteredFigures"
                :key="key"
                @click="addFigureReferenceByKey(key)"
            >
              <img :src="img.base64" width="40" />
              <strong>{{ img.refLabel }}</strong> ({{ key }})
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
  height: auto;
  width: auto;
}



.compact-summary-text {
  font-size: 0.75rem;  /* kleiner als normale Schrift */
  line-height: 1.0;
  max-width: 600px;
}

.toolbar-buttons {
  display: flex;
  align-items: center;
  gap: 6px;

  /* Header-Stil übernehmen */
  background-color: rgba(99, 102, 241, 0.1);
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
  padding: 10px 14px;
  border-top-left-radius: 12px;
  border-top-right-radius: 12px;
  border-bottom-left-radius: 12px;
  border-bottom-right-radius: 12px;

}


.doc-node__body {
  display: flex;
}

.text-node__textarea {
  min-width: 350px;
  min-height: 180px;
  margin: 0 auto;
  min-height: 100px;
  height: 100px;
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

.citation-unknown {
  background-color: #fca5a5; /* Hellrot */
  border: 1px solid #f87171;
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

.figure-tag {
  background: #facc15;
  color: black;
  padding: 4px 8px;
  border-radius: 6px;
  margin-right: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.remove-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  font-weight: bold;
}

.figure-search-list li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px;
  cursor: pointer;
}

</style>