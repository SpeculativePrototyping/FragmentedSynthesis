<script setup lang="ts">
import { computed, ref, watch, watchEffect } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import type { Edge, NodeProps } from '@vue-flow/core'
import '../styles/docNodes.css'

interface DiffSegment {
  type: 'equal' | 'insert' | 'delete'
  text: string
}

interface EditNodeData {
  original?: string
  value?: string
  diff?: DiffSegment[]
}

const props = defineProps<NodeProps<EditNodeData>>()
const { nodes, edges, updateNodeData, removeEdges, updateNodeInternals } = useVueFlow()

// Local state we expose through the node
const editedText = ref(props.data?.value ?? '')
const originalText = ref(props.data?.original ?? '')
const hasManualEdit = ref(Boolean(props.data?.value && props.data?.value !== props.data?.original))
const conflict = ref(false)
let lastSnapshot = ''

// Edit node only supports a single input edge; grab it reactively
const incomingEdge = computed(() => edges.value.find((edge) => edge.target === props.id))

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
</script>

<template>
  <div class="edit-node doc-node">
    <header class="doc-node__header" :class="{ 'doc-node__header-warning': conflict }">
      <strong>Edit</strong>
      <span class="doc-node__hint">
        {{ hasManualEdit ? 'Edited text' : incomingEdge ? 'Ready to edit incoming text' : 'No input connected' }}
      </span>
    </header>

    <section class="doc-node__body edit-node__body">
      <label class="edit-node__label">
        <span>Text</span>
        <textarea
          v-model="editedText"
          class="edit-node__textarea"
          rows="8"
          placeholder="Start typing…"
        ></textarea>
      </label>

      <div class="edit-node__actions">
        <span class="edit-node__summary">
          <span :class="{ 'edit-node__summary--positive': additions }">+{{ additions }}</span>
          <span :class="{ 'edit-node__summary--negative': deletions }">-{{ deletions }}</span>
        </span>

        <button type="button" class="edit-node__reset" :disabled="!hasManualEdit" @click="resetEdits">
          Reset to original
        </button>
      </div>
    </section>

    <Handle id="input" type="target" :position="Position.Left" />
    <Handle id="output" type="source" :position="Position.Right" />
  </div>
</template>

<style scoped>
.edit-node {
  width: 320px;
}

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
  width: 100%;
  min-height: 160px;
  padding: 10px 12px;
  border: 1px solid rgba(15, 23, 42, 0.15);
  border-radius: 10px;
  background-color: #fff;
  font: inherit;
  line-height: 1.45;
  resize: vertical;
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
