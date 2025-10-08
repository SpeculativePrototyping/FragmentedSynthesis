<script setup lang="ts">
import { computed, watch, watchEffect } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import type { Edge, NodeProps } from '@vue-flow/core'
// Shared visual foundation for all document-style nodes.
import '../styles/docNodes.css'

/**
 * Data we expose to the rest of the graph.
 * `concatenated` will hold the combined output so downstream nodes can read it.
 */
interface ConcatNodeData {
  concatenated?: string
}

/**
 * We receive all node context via the standard Vue Flow NodeProps generic.
 * The `<ConcatNode>` never mutates props directly; it talks to Vue Flow helpers instead.
 */
const props = defineProps<NodeProps<ConcatNodeData>>()

/**
 * Vue Flow exposes live node + edge state through `useVueFlow`.
 * We only read from `nodes` and `edges`, and use `updateNodeData` to push output.
 */
const { nodes, edges, updateNodeData, updateNodeInternals } = useVueFlow()

/**
 * Layout constants that mirror the shared doc-node styles.
 * If the CSS changes, update these numbers so handle positions stay aligned.
 */
const HEADER_HEIGHT = 56
const BODY_PADDING_TOP = 12
const ROW_HEIGHT = 32
const ROW_GAP = 6

/**
 * Extract edges that land on this node so we know which inputs are connected.
 * Vue Flow keeps the list reactive for us.
 */
const incomingEdges = computed(() =>
  edges.value.filter((edge) => edge.target === props.id),
)

/**
 * Helper that turns the `targetHandle` string (e.g. "input-2") into a numeric index.
 * When no handle exists yet we return -1 so we can skip it.
 */
function parseHandleIndex(handleId?: Edge['targetHandle']): number {
  if (!handleId) {
    return -1
  }

  const [, rawIndex] = String(handleId).split('-')
  const parsed = Number.parseInt(rawIndex ?? '', 10)

  return Number.isFinite(parsed) ? parsed : -1
}

/**
 * Uses the incoming nodes to derive a human-friendly preview.
 * We only show the first few words for clarity.
 */
function buildPreviewText(candidate?: { data?: Record<string, unknown> }): string {
  if (!candidate?.data) {
    return ''
  }

  const raw = (candidate.data.value ?? candidate.data.label ?? '') as string
  if (!raw) {
    return ''
  }

  return raw.trim().split(/\s+/).slice(0, 5).join(' ')
}

/**
 * Returns text the concat node should emit for a given connected source node.
 * We prefer `value` for richer nodes but fall back to `label`.
 */
function buildFullText(candidate?: { data?: Record<string, unknown> }): string {
  if (!candidate?.data) {
    return ''
  }

  const raw = (candidate.data.value ?? candidate.data.label ?? '') as string
  return raw ?? ''
}

/**
 * Takes the current set of connections and prepares a row for every input handle.
 * We always create one extra empty row so the user can attach a new edge.
 */
const handleRows = computed(() => {
  const rows: Array<{
    index: number
    preview: string
    isConnected: boolean
    handleId: string
    handleTopPx: number
  }> = []

  const mappedEdges = incomingEdges.value.map((edge) => ({
    edge,
    index: parseHandleIndex(edge.targetHandle),
  }))

  const highestUsedIndex = mappedEdges.reduce(
    (currentMax, item) =>
      item.index > currentMax ? item.index : currentMax,
    -1,
  )

  const totalRows = Math.max(highestUsedIndex + 2, mappedEdges.length + 1)

  for (let index = 0; index < totalRows; index += 1) {
    const matchingEdge = mappedEdges.find((item) => item.index === index)?.edge
    const sourceNode = matchingEdge
      ? nodes.value.find((node) => node.id === matchingEdge.source)
      : undefined
    /**
     * Each handle sits horizontally beside its row.
     * We align to the middle of the row so the line hits the text, not the gap.
     */
    const topPx =
      HEADER_HEIGHT +
      BODY_PADDING_TOP +
      index * (ROW_HEIGHT + ROW_GAP) +
      ROW_HEIGHT / 2

    rows.push({
      index,
      preview: buildPreviewText(sourceNode),
      isConnected: Boolean(matchingEdge),
      handleId: `input-${index}`,
      handleTopPx: topPx,
    })
  }

  return rows
})

/**
 * Join together every connected input's text to produce the final concat output.
 * Empty rows do not contribute to the final string.
 */
const concatenatedValue = computed(() => {
  const pieces = incomingEdges.value
    .map((edge) => {
      const sourceNode = nodes.value.find((node) => node.id === edge.source)
      return buildFullText(sourceNode)
    })
    .filter((piece) => Boolean(piece))

  return pieces.join('')
})

/**
 * Whenever the concat output changes we push it back into Vue Flow.
 * This keeps downstream nodes in sync without mutating props.
 */
watchEffect(() => {
  if (props.data?.concatenated === concatenatedValue.value) {
    return
  }

  updateNodeData(props.id, {
    ...props.data,
    concatenated: concatenatedValue.value,
  })
})

watch(
  incomingEdges,
  () => {
    updateNodeInternals?.(props.id)
  },
  { deep: true, immediate: true },
)
</script>

<template>
  <div class="doc-node concat-node">
    <header class="doc-node__header">
      <strong>Concat</strong>
      <span class="doc-node__hint">Combines string inputs in order</span>
    </header>

    <section class="doc-node__body">
      <div
        v-for="row in handleRows"
        :key="row.handleId"
        class="doc-node__row"
        :class="{ 'doc-node__row--connected': row.isConnected }"
      >
        <Handle
          :id="row.handleId"
          type="target"
          :position="Position.Left"
          
          :style="{
            top: `${row.handleTopPx}px`,
          }"
        />
        <span class="concat-node__preview" :title="row.preview || 'No input yet'">
          {{ row.preview || 'Connect...' }}
        </span>

      </div>
    </section>

    <!-- <footer class="concat-node__footer">
      <div class="concat-node__output">
        <span class="concat-node__output-label">Output</span>
        <span class="concat-node__output-value">
          {{ concatenatedValue || 'Waiting for inputs…' }}
        </span>
      </div>

      
    </footer> -->
    <Handle
        id="output"
        type="source"
        :position="Position.Right"
      />
  </div>
</template>

<style scoped>
.concat-node__preview {
  color: rgba(57, 57, 57, 0.8);
  font-size: 0.8rem;
  line-height: 1.2;
  min-height: 1.2em;
}

.concat-node__footer {
  align-items: center;
  background-color: rgba(15, 23, 42, 0.04);
  border-top: 1px solid rgba(15, 23, 42, 0.08);
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  padding: 10px 14px;
}

.concat-node__output {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.concat-node__output-label {
  color: rgba(15, 23, 42, 0.6);
  font-size: 0.75rem;
}

.concat-node__output-value {
  color: #6366f1;
  font-size: 0.85rem;
  font-weight: 600;
}
</style>
