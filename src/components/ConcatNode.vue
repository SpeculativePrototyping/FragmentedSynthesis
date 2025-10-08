<script setup lang="ts">
import { computed, ref, watch, watchEffect, nextTick } from 'vue'
import { Handle, Position, useVueFlow, ConnectionMode } from '@vue-flow/core'
import { uuid } from 'vue-uuid'
import type { Edge, NodeProps } from '@vue-flow/core'
import '../styles/docNodes.css'
import type { transform } from 'typescript'

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
const { nodes, edges, updateNodeInternals, updateNodeData, removeEdges } = useVueFlow()

/**
 * Extract edges that land on this node so we know which inputs are connected.
 * Vue Flow keeps the list reactive for us.
 */
const incomingEdges = computed(() => edges.value.filter((edge) => edge.target === props.id))

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
// const handleRows = computed(() => {
//   const rows: Row[] = []
//   const connected = incomingEdges.value

//   const totalRows = Math.max(connected.length + 1, 1)

//   for (let index = 0; index < totalRows; index += 1) {
//     const matchingEdge = connected[index] // or connected.find(...your criteria...)
//     const sourceNode = matchingEdge
//       ? nodes.value.find((node) => node.id === matchingEdge.source)
//       : undefined

//     const handleId = matchingEdge?.targetHandle ?? getEmptyHandleId(index)
//     const percentage = ((index + 1) / (totalRows + 1)) * 100

//     rows.push({
//       index,
//       preview: buildPreviewText(sourceNode),
//       isConnected: Boolean(matchingEdge),
//       handleId,
//       handleTop: `${percentage}%`,
//     })
//   }
//   // trim cached IDs for rows that no longer exist
//   for (const key of emptyHandleIds.value.keys()) {
//     if (key >= totalRows) emptyHandleIds.value.delete(key)
//   }

//   return rows
// })
const handleRows = computed(() => {
  const rows = []

  // **FIX 1: Find the REAL highest connected index by reading the handle IDs.**
  // We can't rely on the array's length.
  const connectedIndices = incomingEdges.value.map((edge) => parseHandleIndex(edge.targetHandle))
  const maxIndex = Math.max(-1, ...connectedIndices)

  // **FIX 2: The total number of rows is always one more than the highest port in use.**
  const totalRows = maxIndex + 2

  for (let index = 0; index < totalRows; index += 1) {
    // **FIX 3: Find the matching edge by its handle index, NOT its array position.**
    const matchingEdge = incomingEdges.value.find(
      (edge) => parseHandleIndex(edge.targetHandle) === index,
    )

    const sourceNode = matchingEdge
      ? nodes.value.find((node) => node.id === matchingEdge.source)
      : undefined

    // This is the original vertical positioning logic you had. It's important!
    // We calculate the percentage to vertically space the handles evenly.
    const percentage = ((index + 0.5) / totalRows) * 100

    rows.push({
      index,
      preview: buildPreviewText(sourceNode),
      isConnected: Boolean(matchingEdge),
      // We will fix the handle ID in the next step. For now, this is closer.
      handleId: `input-${index}`,
      handleTop: `${percentage}%`, // This provides the dynamic height for the handle!
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
    .slice() // Create a copy so we don't mutate the original
    // **ADD THIS SORTING LOGIC**
    .sort((a, b) => parseHandleIndex(a.targetHandle) - parseHandleIndex(b.targetHandle))
    .map((edge) => {
      const sourceNode = nodes.value.find((node) => node.id === edge.source)
      return buildFullText(sourceNode)
    })
    .filter((piece) => Boolean(piece))

  return pieces.join(' ')
})

/**
 * Whenever the number of input rows changes we need to tell Vue Flow to recalculate.
 * We also clean up any edges that are now connected to a non-existent handle.
 */
watch(
  handleRows,
  async (rows) => {
    // We still need to wait for the DOM to update
    await nextTick()
    // And we still need to tell Vue Flow to check the node's dimensions
    updateNodeInternals?.(props.id)

    // **HERE IS THE CRITICAL ADDITION:**
    // Create a Set of all handle IDs that are currently visible on the node.
    const validHandles = new Set(rows.map((r) => r.handleId))

    // Find any incoming edge that is connected to a handle that is NO LONGER in our valid set.
    // These are the "ghost" edges.
    const staleEdges = incomingEdges.value.filter(
      (edge) => edge.targetHandle && !validHandles.has(edge.targetHandle),
    )

    // If we found any stale/ghost edges, command Vue Flow to remove them immediately.
    if (staleEdges.length) {
      removeEdges(staleEdges)
    }
  },
  {
    // We need deep watching here to detect changes inside the rows.
    deep: true,
  },
)

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
    value: concatenatedValue.value,
  })
})
</script>

<template>
  <!-- <VueFlow :connection-mode="ConnectionMode.Strict" /> -->
  <div class="concat-node doc-node">
    <header class="concat-node__header doc-node__header">
      <strong>Concat</strong>
      <span class="concat-node__hint doc-node__hint">Combines text inputs</span>
    </header>

    <section class="concat-node__inputs doc-node__body">
      <div
        v-for="row in handleRows"
        :key="row.handleId"
        class="concat-node__input-row doc-node__row"
        :class="{
          'concat-node__input-row--connected': row.isConnected,
          'doc-node__row--connected': row.isConnected,
        }"
      >
        <div class="concat-node__preview" :title="row.preview || 'No input yet'">
          {{ row.preview || 'Connect text...' }}
        </div>
        <Handle
          :id="row.handleId"
          type="target"
          :position="Position.Left"
          :style="{
            //  top: row.handleTop,
            left: '-12px',
            transform: 'translate(-50%, -50%)',
          }"
        />
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
    <Handle id="output" type="source" :position="Position.Right" />
  </div>
</template>

<style scoped>
.concat-node__preview {
  color: rgba(57, 57, 57, 0.8);
  font-size: 0.8rem;
  line-height: 1.2;
  display: block; /* not inline */
  flex: 1 1 auto; /* fill leftover space */
  overflow: hidden;
  white-space: nowrap; /* single-line truncation */
  text-overflow: ellipsis;
}
.concat-node__inputs {
  display: block;
}

/* each row = flex; Handle can stay absolutely positioned */
.concat-node__input-row,
.doc-node__row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0; /* critical */
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

.concat-node {
  box-sizing: border-box;
  max-width: 150px;
}
</style>
