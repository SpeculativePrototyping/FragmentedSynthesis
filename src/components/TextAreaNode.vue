<script lang="ts" setup>
import {ref, watch, computed, inject, nextTick, onMounted, onBeforeUnmount} from 'vue'
import {Handle, Position, useVueFlow} from '@vue-flow/core'
import type {NodeProps} from '@vue-flow/core'
import {enqueueLlmJob} from '../api/llmQueue'
import {NodeToolbar} from '@vue-flow/node-toolbar'
import type {Ref} from 'vue'
import {textNodePrompts} from '@/nodes/prompts'
import '../styles/docNodes.css'


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
const {updateNodeData, nodes, edges, removeNodes} = useVueFlow()
const isCompact = ref(false)
const text = ref<string>(String(props.data?.value ?? ''))
const summary = ref("")
const status = ref<SummaryStatus>((props.data?.status as SummaryStatus) ?? 'idle')
const availableSources = computed(() => bibliography.value)
const TLDR = inject('TLDR')
const textAreaRef = ref<HTMLTextAreaElement | null>(null)
const cursorPos = ref<{ start: number; end: number }>({start: 0, end: 0})
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
    return
  }

  const token = ++requestToken
  summary.value = ''
  status.value = "queued"

  // Hier holen wir dynamisch die Prompts
  const {basePrompt, responseFormat} = getPrompts()

  try {
    const result = await enqueueLlmJob({
      sys: basePrompt,
      user: txt,
      responseFormat,
      onStart: () => {
      },
    })

    if (token !== requestToken) return

    const msg = result.message || ''
    const parsed = (() => {
      try {
        return JSON.parse(msg)
      } catch {
        return null
      }
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
  const {start, end} = cursorPos.value

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
    updateNodeData(props.id, {...props.data, citations})
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
  updateNodeData(props.id, {...props.data, citations: newCitations, value: text.value})
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

function scanCitationsFromText() {
  if (!props.data) return

  // 🔹 Citations
  const citations = new Set<string>()
  const citationMatches = text.value.matchAll(COMPLETE_CITATION_REGEX)
  for (const match of citationMatches) {
    const key = match[1].trim()
    if (key) citations.add(key)
  }

  // 🔹 Figures / Autorefs
  const figures = new Set<string>()
  for (const [imageName, img] of Object.entries(imageCache.value)) {
    const label = img.refLabel
    if (!label) continue
    const regex = new RegExp(`~\\\\autoref\\{${label}\\}`, 'g')
    if (regex.test(text.value)) {
      figures.add(imageName)
    }
  }

  updateNodeData(props.id, {
    ...props.data,
    citations: Array.from(citations),
    figures: Array.from(figures),
  })
}


function reinsertCitation(key: string) {
  const textarea = textAreaRef.value
  const citationText = `~\\cite{${key}}`
  const {start, end} = cursorPos.value

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
  updateNodeData(props.id, {...props.data, value: text.value})
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

  // 🔹 Initial Scan von Text für importierte Nodes
  scanCitationsFromText()

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
}, {deep: true})


watch(TLDR, (val) => {
  if (typeof val === 'boolean') {
    isCompact.value = val
  }
})

function deleteNode() {
  removeNodes([props.id])
}


// Debounced push to Vue Flow state so downstream nodes can read `data.value`
let timer: number | undefined
watch(text, (v) => {
  window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    updateNodeData(props.id, {...props.data, value: v})
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
  const {start, end} = cursorPos.value

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

  updateNodeData(props.id, {...props.data, figures: [...figs]})
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

function undo(textarea: HTMLTextAreaElement | null) {
  if (!textarea) return
  document.execCommand('undo') // ruft die Browser-Undo-Funktion auf
}

function redo(textarea: HTMLTextAreaElement | null) {
  if (!textarea) return
  document.execCommand('redo') // ruft die Browser-Redo-Funktion auf
}


</script>

<template>

  <NodeToolbar>
    <div class="toolbar-buttons">
      <button
          class="delete-node-btn"
          title="Delete this node"
          @click="deleteNode"
      >
        🗑️
      </button>

      <button class="toolbar-mini-btn" title="Undo" @click="undo">
        ↶
      </button>

      <button class="toolbar-mini-btn" title="Redo" @click="redo">
        ↷
      </button>

      <!-- NEW: Citation Toggle -->
      <button
          :class="{ active: showSearch }"
          class="toolbar-mini-btn"
          title="Cite Sources"
          @click="showSearch = !showSearch"
      >
        📚
      </button>

      <!-- NEW: Figure Toggle -->
      <button
          :class="{ active: showFigureSearch }"
          class="toolbar-mini-btn"
          title="Reference Figures"
          @click="showFigureSearch = !showFigureSearch"
      >
        🖼️
      </button>

      <label class="mini-toggle-switch" title="Show a short summary (TLDR).">
        <input v-model="isCompact" type="checkbox"/>
        <span class="slider"></span>
      </label>
      <span class="toggle-label">TLDR</span>

    </div>
  </NodeToolbar>


  <div ref="nodeRef" class="text-node doc-node node-wrapper">
    <header class="doc-node__header">
      <strong :class="{ 'compact-summary-text': isCompact }">
        {{ isCompact ? (summary || 'Text Input Node') : (props.data?.label ?? 'Text Node') }}
      </strong>
      <span v-if="!isCompact" class="doc-node__hint">{{ statusLabel }}</span>
    </header>

    <section v-if="!isCompact" class="doc-node__body">
      <textarea
          v-if="!isCompact"
          ref="textAreaRef"
          v-model="text"
          :placeholder="props.data?.placeholder ?? 'This node is for text input. Type here and connect it to other nodes...'"
          aria-label="Text node editor"
          autocapitalize="sentences"
          autocomplete="on"
          class="text-node__textarea"
          data-gramm="true"
          data-gramm_editor="true"
          rows="6"
          spellcheck="true"
          @click="updateCursorPosition"
          @keyup="updateCursorPosition"
          @select="updateCursorPosition"
          @wheel.stop
      />

      <div v-else class="compact-summary">
        {{ summary }}
      </div>

      <div v-if="!isCompact" class="citations-ui">
        <div class="selected-citations">
<span
    v-for="key in props.data.citations ?? []"
    :key="key"
    :class="{ 'citation-unknown': invalidCitations.has(key) }"
    class="citation-tag"
>
  <span style="cursor: pointer;" @click="reinsertCitation(key)">
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
        <div v-if="showFigureSearch" class="citation-search">
          <input
              v-model="searchFigureQuery"
              class="citation-search-input"
              placeholder="Search figures..."
          />

          <ul class="citation-search-list" @wheel.stop>
            <li
                v-for="([key, img]) in filteredFigures"
                :key="key"
                @click="addFigureReferenceByKey(key)"
            >
              <img :src="img.base64" width="40"/>
              <strong>{{ img.refLabel }}</strong>
            </li>
          </ul>
        </div>
      </div>

    </section>
    <Handle id="output" :position="Position.Right" type="source"/>
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
  font-size: 0.75rem; /* kleiner als normale Schrift */
  line-height: 1.0;
  max-width: 600px;
}



.doc-node__body {
  display: flex;
}

.text-node__textarea {
  min-width: 350px;
  min-height: 180px;
  height: 100px;
  margin: 0 auto;
  padding: 10px 12px;
  border: 1px solid rgba(15, 23, 42, .15);
  border-radius: 10px;
  background: #fff;
  font: inherit;
  line-height: 1.45;
  resize: both;
  box-sizing: border-box;
}

.text-node__textarea:focus {
  outline: 2px solid rgba(99, 102, 241, .45);
  border-color: rgba(99, 102, 241, .45);
}

.compact-summary {
  width: 600px;
  max-height: 240px;
  padding: 10px 12px;
  border: 1px solid rgba(15, 23, 42, .15);
  border-radius: 10px;
  background: #fff;
  font: inherit;
  font-size: x-small;
  line-height: 1.00;
  overflow: auto;
}

.
.node-wrapper:hover .node-hover-toggle {
  opacity: 1;
  pointer-events: auto;
}


</style>