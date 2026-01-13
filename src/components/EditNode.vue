<script setup lang="ts">
import {computed, inject, onBeforeUnmount, onMounted, type Ref, ref, watch, watchEffect, nextTick} from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import type { Edge, NodeProps } from '@vue-flow/core'
import { reviewPrompts } from '@/nodes/prompts'
import { enqueueLlmJob } from '../api/llmQueue'

import '../styles/docNodes.css'
import {NodeToolbar} from "@vue-flow/node-toolbar";

interface DiffSegment {
  type: 'equal' | 'insert' | 'delete'
  text: string
}

interface EditNodeData {
  original?: string
  value?: string
  diff?: DiffSegment[]
  citations?: string[]
  figures?: string[]
  label?: string
  width?: number
  height?: number
}

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

const props = defineProps<NodeProps<EditNodeData>>()
const { nodes, edges, updateNodeData, removeEdges, removeNodes, updateNodeInternals } = useVueFlow()
const editedText = ref(props.data?.value ?? '')
const originalText = ref(props.data?.original ?? '')
const hasManualEdit = ref(Boolean(props.data?.value && props.data?.value !== props.data?.original))
const conflict = ref(false)
const availableSources = computed(() => bibliography.value)
const textAreaRef = ref<HTMLTextAreaElement | null>(null)
let lastSnapshot = ''
const nodeRef = ref<HTMLElement | null>(null)
let resizeObs: ResizeObserver | null = null
let resizeRaf: number | null = null
const cursorPos = ref<{ start: number; end: number }>({ start: 0, end: 0 })
const searchQuery = ref('')
const showSearch = ref(false)
const COMPLETE_CITATION_REGEX = /~\\cite\{([^\}]+)\}(?=\s|$)/g
const searchFigureQuery = ref('')
const showFigureSearch = ref(false)
const bibliography = inject<Ref<BibEntry[]>>('bibliography')!
const imageCache = inject<Ref<ImageCache>>('imageCache')!
const language = inject<Ref<'en' | 'de'>>('language')!  // globaler Sprachstatus
const reviewerComment = ref('')
const reviewerOutput = ref('')      // LLM-Ergebnis
const status = ref<'idle'|'queued'|'processing'|'done'|'error'>('idle')
const error = ref<string|null>(null)
const showReviewer = ref(false)  // steuert die Sichtbarkeit
const incomingEdge = computed(() => edges.value.find((edge) => edge.target === props.id))
const incomingCitations = computed(() => {
  const edge = incomingEdge.value
  if (!edge) return []
  return readNodeCitations(edge.source)
})

const invalidCitations = computed(() => {
  if (!props.data?.citations) return new Set<string>();
  const bibKeys = new Set(bibliography.value.map(entry => entry.id));
  return new Set(props.data.citations.filter(key => !bibKeys.has(key)));
});

const filteredSources = computed(() => {
  if (!searchQuery.value) return availableSources.value
  const query = searchQuery.value.toLowerCase()
  return availableSources.value.filter(entry =>
      (entry.fields.author ?? '').toLowerCase().includes(query) ||
      (entry.fields.title ?? '').toLowerCase().includes(query) ||
      entry.id.toLowerCase().includes(query)
  )
})

const filteredFigures = computed(() => {
  const q = searchFigureQuery.value.toLowerCase()
  if (!q) return Object.entries(imageCache.value)

  return Object.entries(imageCache.value).filter(([key, img]) =>
      img.refLabel.toLowerCase().includes(q)
  )
})


// NEU: Status Label für EditNode
const statusLabel = computed(() => {
  if (conflict.value) return 'Conflict: Manual edits differ from source'
  switch (status.value) {
    case 'queued': return 'Status: queued…'
    case 'processing': return 'Status: processing…'
    case 'done': return 'Status: done'
    case 'error': return `Error: ${error.value ?? 'unknown'}`
    default: return 'Status: idle'
  }
})

// TLDR / Compact
const TLDR = inject('TLDR')
const isCompact = ref(false)
watch(TLDR, (val) => {
  if (typeof val === 'boolean') isCompact.value = val
})


/**
 * Reads text from whichever node is connected to the input handle.
 */
function readNodeText(nodeId: string): string {
  const source = nodes.value.find((node) => node.id === nodeId)
  if (!source?.data) return ''
  const data = source.data as Record<string, unknown>
  const candidate = data.value ?? data.label ?? ''
  return typeof candidate === 'string' ? candidate : ''
}

function readNodeCitations(nodeId: string): string[] {
  const source = nodes.value.find((node) => node.id === nodeId)
  if (!source?.data) return []
  const data = source.data as Record<string, unknown>

  const c = data.citations
  return Array.isArray(c) ? c as string[] : []
}

function updateCursorPosition() {
  const el = textAreaRef.value
  if (el) cursorPos.value = { start: el.selectionStart, end: el.selectionEnd }
}

function addCitationByKey(key: string) {
  const citationText = `~\\cite{${key}}`
  const { start, end } = cursorPos.value
  if (!textAreaRef.value || start == null) {
    editedText.value += citationText
  } else {
    editedText.value = editedText.value.slice(0, start) + citationText + editedText.value.slice(end)
    nextTick(() => {
      textAreaRef.value!.focus()
      textAreaRef.value!.selectionStart = textAreaRef.value!.selectionEnd = start + citationText.length
    })
  }

  const citations = props.data.citations ? [...props.data.citations] : []
  if (!citations.includes(key)) citations.push(key)
  updateNodeData(props.id, { ...props.data, citations })

  searchQuery.value = ''
  showSearch.value = false
}

function removeCitation(key: string) {
  const citations = props.data.citations ? [...props.data.citations] : []
  const newCitations = citations.filter(c => c !== key)
  const regex = new RegExp(`~\\\\cite\\{${key}\\}`, 'g')
  editedText.value = editedText.value.replace(regex, '').replace(/\s{2,}/g, ' ').trim()
  updateNodeData(props.id, { ...props.data, citations: newCitations, value: editedText.value })
}

function reinsertCitation(key: string) {
  addCitationByKey(key)
}

function addFigureReferenceByKey(imageName: string) {
  const img = imageCache.value[imageName]
  if (!img) return
  const insertText = `~\\autoref{${img.refLabel}}`
  const { start, end } = cursorPos.value

  if (!textAreaRef.value || start == null) {
    editedText.value += insertText
  } else {
    editedText.value = editedText.value.slice(0, start) + insertText + editedText.value.slice(end)
    nextTick(() => {
      textAreaRef.value!.focus()
      textAreaRef.value!.selectionStart = textAreaRef.value!.selectionEnd = start + insertText.length
    })
  }

  const figs = new Set(props.data.figures ?? [])
  figs.add(imageName)
  updateNodeData(props.id, { ...props.data, figures: [...figs] })
}

function removeFigureReference(imageName: string) {
  const img = imageCache.value[imageName]
  if (!img) return
  const regex = new RegExp(`~\\\\autoref\\{${img.refLabel}\\}`, 'g')
  editedText.value = editedText.value.replace(regex, '').replace(/\s{2,}/g, ' ').trim()

  const figs = (props.data.figures ?? []).filter(f => f !== imageName)
  updateNodeData(props.id, { ...props.data, figures: figs, value: editedText.value })
}

function reinsertFigureReference(key: string) {
  addFigureReferenceByKey(key)
}

function getPrompts() {
  return reviewPrompts[language.value]
}

let debounceTimer: number | undefined
let requestToken = 0

function scheduleReview(force = false) {
  window.clearTimeout(debounceTimer)
  debounceTimer = window.setTimeout(() => {
    void queueReview(force)
  }, force ? 0 : 200)
}

async function queueReview(force: boolean) {
  const comment = reviewerComment.value.trim()
  const input = editedText.value.trim()

  if (!input || !comment) return
  const token = ++requestToken
  status.value = 'queued'
  error.value = null

  status.value = 'processing'

  const prompts = getPrompts()
  const basePrompt = prompts.systemPrompt
  const responseFormat = prompts.responseFormat

  try {
    const userInput = `Original Text:\n${input}\n\nReviewer Comment:\n${comment}`

    const result = await enqueueLlmJob({
      sys: basePrompt,
      user: userInput,
      responseFormat,
      onStart: () => {}
    })

    let updatedText = input
    try {
      const parsed = JSON.parse(result.message || '{}')
      updatedText = parsed.value?.trim() ?? input  // statt parsed.paraphrase
    } catch {
      updatedText = input
    }

    // **Hier schreiben wir direkt in editedText**
    editedText.value = updatedText
    status.value = 'done'

    updateNodeData(props.id, {
      ...props.data,
      value: updatedText
    })

  } catch (err) {
    status.value = 'error'
    error.value = err instanceof Error ? err.message : String(err)
  }



}



// Auto-detect citations in text
let citationTimer: number | undefined
watch(editedText, (currentText) => {
  window.clearTimeout(citationTimer)
  citationTimer = window.setTimeout(() => {
    const found = new Set<string>()
    for (const match of currentText.matchAll(COMPLETE_CITATION_REGEX)) {
      const key = match[1].trim()
      if (key) found.add(key)
    }
    updateNodeData(props.id, { ...props.data, citations: Array.from(found) })
  }, 5000)
})

// Auto-detect figure references
let figureTimer: number | undefined
watch(editedText, (currentText) => {
  window.clearTimeout(figureTimer)
  figureTimer = window.setTimeout(() => {
    const found = new Set<string>()
    for (const [key, img] of Object.entries(imageCache.value)) {
      if (!img.refLabel) continue
      const regex = new RegExp(`~\\\\autoref\\{${img.refLabel}\\}`, 'g')
      if (regex.test(currentText)) found.add(key)
    }
    updateNodeData(props.id, { ...props.data, figures: [...found] })
  }, 5000)
})


// Whenever the incoming edge changes we sync the "original" starting text
watch(
    () => incomingEdge.value,
    (edge) => {
      const text = edge ? readNodeText(edge.source) : ''
      if (text === originalText.value) return

      originalText.value = text
      if (!hasManualEdit.value) {
        editedText.value = text
        conflict.value = false
      } else {
        conflict.value = true
      }
    },
    { immediate: true },
)

// Track whether the user has made changes relative to the original snapshot
watch(editedText, () => {
  hasManualEdit.value = editedText.value !== originalText.value
  if (!hasManualEdit.value) conflict.value = false
})

// Word-level diff we expose to downstream nodes for future features
const diffSegments = computed(() => diffTokens(originalText.value, editedText.value))

const additions = computed(() =>
    diffSegments.value.reduce((total, segment) => (segment.type === 'insert' ? total + segment.text.length : total), 0),
)
const deletions = computed(() =>
    diffSegments.value.reduce((total, segment) => (segment.type === 'delete' ? total + segment.text.length : total), 0),
)

// Push the node data to Vue Flow once it actually changed (prevents update loops)
watchEffect(() => {
  const snapshot = {
    original: originalText.value,
    value: editedText.value,
    diff: diffSegments.value,
    citations: incomingCitations.value,
  }
  const serialised = JSON.stringify(snapshot)
  if (serialised === lastSnapshot) return
  lastSnapshot = serialised
  updateNodeData(props.id, { ...props.data, ...snapshot })
})

// Defensive cleanup in case someone wires up the wrong handle id
watch(
    () => incomingEdge.value,
    async (edge) => {
      await updateNodeInternals?.([props.id])
      if (edge && edge.targetHandle !== 'input') {
        removeEdges([edge])
      }
    },
    { immediate: true },
)

function resetEdits() {
  editedText.value = originalText.value
  hasManualEdit.value = false
  conflict.value = false
}

function tokenize(text: string): string[] {
  return text.split(/(\s+|[.,;:!?()\[\]{}"'])/u).filter((part) => part !== '')
}

function pushSegment(segments: DiffSegment[], type: DiffSegment['type'], token: string) {
  const last = segments[segments.length - 1]
  if (last && last.type === type) {
    last.text += token
  } else {
    segments.push({ type, text: token })
  }
}

function diffTokens(original: string, edited: string): DiffSegment[] {
  if (original === edited) {
    return original ? [{ type: 'equal', text: original }] : []
  }

  const a = tokenize(original)
  const b = tokenize(edited)
  const m = a.length
  const n = b.length

  const lcs: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = m - 1; i >= 0; i -= 1) {
    const row = lcs[i]!
    const nextRow = lcs[i + 1]!
    for (let j = n - 1; j >= 0; j -= 1) {
      if (a[i] === b[j]) {
        row[j] = nextRow[j + 1]! + 1
      } else {
        row[j] = Math.max(nextRow[j]!, row[j + 1]!)
      }
    }
  }

  const segments: DiffSegment[] = []
  let i = 0
  let j = 0

  while (i < m && j < n) {
    if (a[i] === b[j]) {
      pushSegment(segments, 'equal', a[i]!)
      i += 1
      j += 1
    } else {
      const down = lcs[i + 1]?.[j] ?? 0
      const right = lcs[i]?.[j + 1] ?? 0
      if (down >= right) {
        pushSegment(segments, 'delete', a[i]!)
        i += 1
      } else {
        pushSegment(segments, 'insert', b[j]!)
        j += 1
      }
    }
  }

  while (i < m) {
    pushSegment(segments, 'delete', a[i]!)
    i += 1
  }

  while (j < n) {
    pushSegment(segments, 'insert', b[j]!)
    j += 1
  }

  return segments
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

watch(language, () => {
  if (status.value === 'done') scheduleReview(true)
})

function onRetry() {
  scheduleReview(true)
}

function refreshFromSource() {
  const edge = incomingEdge.value
  if (!edge) return

  const newText = readNodeText(edge.source)
  originalText.value = newText
  editedText.value = newText
  hasManualEdit.value = false
  conflict.value = false
}


function deleteNode() {
  removeNodes([props.id])
}

</script>

<template>


  <NodeToolbar>
    <div class="toolbar-buttons">
      <button class="delete-node-btn" @click="deleteNode" title="Delete this node">
        🗑️
      </button>

      <button type="button" class="toolbar-mini-btn" :disabled="!incomingEdge" @click="refreshFromSource" title="Refresh from source">
        🔄
      </button>

      <button type="button" class="toolbar-mini-btn" :disabled="!hasManualEdit" @click="resetEdits" title="Reset to original">
        ↩️
      </button>

      <!-- NEW: Citation Toggle -->
      <button
          class="toolbar-mini-btn"
          :class="{ active: showSearch }"
          @click="showSearch = !showSearch"
          title="Cite Sources"
      >
        📚
      </button>

      <!-- NEW: Figure Toggle -->
      <button
          class="toolbar-mini-btn"
          :class="{ active: showFigureSearch }"
          @click="showFigureSearch = !showFigureSearch"
          title="Reference Figures"
      >
        🖼️
      </button>

      <button
          class="toolbar-mini-btn"
          :class="{ active: showReviewer }"
          @click="showReviewer = !showReviewer"
          title="Apply review comment"
      >
        🔍
      </button>

      <label class="mini-toggle-switch" title="Compact view / TLDR">
        <input type="checkbox" v-model="isCompact"/>
        <span class="slider"></span>
      </label>
      <span class="mini-toggle-label">TLDR</span>


    </div>
  </NodeToolbar>



  <div class="edit-node doc-node" ref="nodeRef">
    <header class="doc-node__header" :class="{ 'doc-node__header-warning': conflict }">
      <strong>{{ props.data?.label ?? 'Text' }}</strong>
      <span class="doc-node__hint">{{ statusLabel }}</span>
    </header>

    <section class="doc-node__body edit-node__body" v-if="!isCompact">
      <label class="edit-node__label">
        <textarea
            ref="textAreaRef"
            @wheel.stop
            v-model="editedText"
            class="edit-node__textarea"
            rows="8"
            @select="updateCursorPosition"
            @keyup="updateCursorPosition"
            @click="updateCursorPosition"
            placeholder="With this node, you can edit incoming text and add citations or references. You can reset to the original incoming text or update if the source has changed."
        ></textarea>
        <div class="edit-node__actions">
        <span class="edit-node__summary">
          <span :class="{ 'edit-node__summary--positive': additions }">+{{ additions }}</span>
          <span :class="{ 'edit-node__summary--negative': deletions }">-{{ deletions }}</span>
        </span>
        </div>
        <div  class="citations-ui">
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

        <div  class="figures-ui">
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

        <textarea
          v-model="reviewerComment"
          v-if="showReviewer"
          @wheel.stop
          class="edit-node__textarea2"
          rows="3"
          placeholder="Paste reviewer comment here to automatically rewrite the text based on comments from your professor, editor or reviewer.">
        </textarea>
        <button
            v-if="showReviewer"
            class="citation-add-btn"
            :disabled="status==='processing' || !reviewerComment.trim()"
            @click="queueReview(true)">
          Apply Reviewer Comment
        </button>
      </label>
    </section>
    <Handle id="input" type="target" :position="Position.Left" />
    <Handle id="output" type="source" :position="Position.Right" />
  </div>
</template>

<style scoped>


.edit-node__body {
  gap: 12px;
}

.edit-node__label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.9rem;
}

.edit-node__textarea {
  min-width: 350px;
  min-height: 180px;
  margin: 0 auto;
  padding: 10px 12px;
  border: 1px solid rgba(15, 23, 42, 0.15);
  border-radius: 10px;
  background-color: #fff;
  font: inherit;
  line-height: 1.45;
  resize: both;
  box-sizing: border-box;
}

.edit-node__textarea2 {
  margin-top: 20px;
  width: 100%;
  min-height: 180px;
  padding: 10px 12px;
  border: 1px solid rgba(15, 23, 42, 0.15);
  border-radius: 10px;
  background-color: #fff;
  font: inherit;
  line-height: 1.45;
  resize: none;
  box-sizing: border-box;
}


.edit-node__actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.edit-node__summary {
  display: flex;
  gap: 8px;
  font-size: 0.85rem;
}

.edit-node__summary--positive {
  color: #0f766e;
}

.edit-node__summary--negative {
  color: #b91c1c;
}

.edit-node__reset {
  border: 1px solid rgba(15, 23, 42, 0.2);
  border-radius: 6px;
  background: white;
  padding: 4px 10px;
  font-size: 0.8rem;
  cursor: pointer;
}

.edit-node__reset:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

</style>
