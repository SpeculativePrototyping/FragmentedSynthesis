<script setup lang="ts">
import { computed, ref, watch, watchEffect, nextTick } from 'vue'
import { Handle, Position, useVueFlow, ConnectionMode } from '@vue-flow/core'
import { uuid } from 'vue-uuid'
import type { Edge, NodeProps } from '@vue-flow/core'
import '../styles/docNodes.css'
import type { transform } from 'typescript'
import type {DocElement, SectionElement } from '../api/docstruct.ts'

/**
 * Data we expose to the rest of the graph.
 * `Compo` will hold the combined output so downstream nodes can read it.
 */
// ——— Props and Vue Flow handles ———
interface ComposeData {
  kind?: DocElement['kind'];       // 'section' | 'paragraph' | 'figure'
  level?: SectionElement['level']; // for sections
  title?: string;
  body?: string;
  src?: string;                 // for figure
  caption?: string;             // for figure
  json?: string;                // emitted JSON cache (for debugging/inspection)
}
/**
 * We receive all node context via the standard Vue Flow NodeProps generic.
 * The `<ConcatNode>` never mutates props directly; it talks to Vue Flow helpers instead.
 */
const props = defineProps<NodeProps<ComposeData>>()

/**
 * Vue Flow exposes live node + edge state through `useVueFlow`.
 * We only read from `nodes` and `edges`, and use `updateNodeData` to push output.
 */
const { nodes, edges, updateNodeInternals, updateNodeData, removeEdges } = useVueFlow()

// ——— Local editable state (mirrors props.data but under our control) ———
const kind      = ref<ComposeData['kind']>(props.data?.kind ?? 'section');
const level     = ref<SectionNode['level']>(props.data?.level ?? 1);
const title     = ref<string>(props.data?.title ?? '');
const body      = ref<string>(props.data?.body ?? '');
const src       = ref<string>(props.data?.src ?? '');
const caption   = ref<string>(props.data?.caption ?? '');

/**
 * Extract edges that land on this node so we know which inputs are connected.
 * Vue Flow keeps the list reactive for us.
 */
// ——— Resolve children: incoming edges with target = this node ———
const incoming = computed(() => edges.value.filter(e => e.target === props.id));
function parseHandleIndex(h?: Edge['targetHandle']) {
  if (!h) return -1; const [, raw] = String(h).split('-'); const n = parseInt(raw ?? '', 10); return Number.isFinite(n) ? n : -1;
}
const childNodes = computed<DocNode[]>(() => {
  // sort by target handle index to give deterministic order
  const sorted = incoming.value.slice().sort((a,b) => parseHandleIndex(a.targetHandle) - parseHandleIndex(b.targetHandle));
  return sorted.map(e => {
    // We expect the source node to emit its DocNode JSON in data.json
    const srcNode = nodes.value.find(n => n.id === e.source);
    const raw = (srcNode?.data as any)?.json as string | undefined;
    try { return raw ? (JSON.parse(raw) as DocNode) : undefined; } catch { return undefined; }
  }).filter(Boolean) as DocNode[];
});
// ——— Build our DocNode from local state + discovered children ———
const assembled = computed<DocNode>(() => {
  const id = props.id;
  switch (kind.value) {
    case 'section':
      return mkSection(id, level.value, { title: title.value, body: body.value, children: childNodes.value });
    case 'paragraph':
      return mkParagraph(id, { title: title.value, body: body.value, children: [] }); // paragraphs have no children
    case 'figure':
      return mkFigure(id, src.value, caption.value, { title: title.value, body: body.value, children: [] });
    default:
      return mkParagraph(id, { title: title.value, body: body.value }); // fallback
  }
});

// ——— Debounced push of JSON downstream ———
let timer: number | undefined;
watch(assembled, (node) => {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    const json = JSON.stringify(node);
    updateNodeData(props.id, { ...props.data, kind: kind.value, level: level.value, title: title.value, body: body.value, src: src.value, caption: caption.value, json });
  }, 120);
}, { deep: true });

// ——— Handles: one output; N child inputs (only for kinds that accept children) ———
const acceptsChildren = computed(() => kind.value === 'section');
const handleRows = computed(() => {
  if (!acceptsChildren.value) return [];
  const maxIndex = Math.max(-1, ...incoming.value.map(e => parseHandleIndex(e.targetHandle)));
  const total = maxIndex + 2;
  return Array.from({ length: total }, (_, i) => ({
    id: `child-${i}`,
    top: `${((i + 0.5) / total) * 100}%`,
    connected: incoming.value.some(e => parseHandleIndex(e.targetHandle) === i),
  }));
});

// Recalculate internals when rows change
watch(handleRows, async () => {
  await nextTick();
  updateNodeInternals?.(props.id);
}, { deep: true });



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
    updateNodeInternals?.([props.id])

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
  <div class="compose doc-node">
    <header class="doc-node__header">
      <strong>Compose</strong>
      <span class="doc-node__hint">Author a document element</span>
    </header>

    <section class="doc-node__body compose__form">
      <label>
        Kind
        <select v-model="kind">
          <option value="section">Section</option>
          <option value="paragraph">Paragraph</option>
          <option value="figure">Figure</option>
        </select>
      </label>

      <label v-if="kind === 'section'">
        Level
        <select v-model="level">
          <option :value="1">1</option>
          <option :value="2">2</option>
          <option :value="3">3</option>
          <option :value="4">4</option>
          <option :value="5">5</option>
          <option :value="6">6</option>
        </select>
      </label>

      <label>
        Title
        <input v-model="title" type="text" placeholder="Optional title" />
      </label>

      <label v-if="kind !== 'figure'">
        Body
        <textarea v-model="body" rows="4" placeholder="Optional body"></textarea>
      </label>

      <template v-if="kind === 'figure'">
        <label>
          Image src
          <input v-model="src" type="text" placeholder="path or URL" />
        </label>
        <label>
          Caption
          <input v-model="caption" type="text" placeholder="Optional caption" />
        </label>
      </template>
    </section>

    <!-- Child input handles (only for sections) -->
    <section v-if="acceptsChildren" class="compose__children">
      <div
        v-for="row in handleRows"
        :key="row.id"
        class="compose__child-row"
        :class="{ 'compose__child-row--connected': row.connected }"
      >
        <span class="compose__slot-hint">{{ row.connected ? 'Child attached' : 'Attach child…' }}</span>
        <Handle
          :id="row.id"
          type="target"
          :position="Position.Left"
          :style="{ top: row.top, left: '-12px', transform: 'translate(-50%, -50%)' }"
        />
      </div>
    </section>

    <!-- Single output with our assembled JSON -->
    <Handle id="out" type="source" :position="Position.Right" />
  </div>
</template>

<style scoped>
.compose { box-sizing: border-box; inline-size: min(36rem, 90%); }
.compose__form {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 8px;
}
.compose__form label { display: grid; gap: 4px; font-size: 0.9rem; }
.compose__form input, .compose__form select, .compose__form textarea {
  width: 100%; box-sizing: border-box; padding: 8px 10px;
  border: 1px solid rgba(15,23,42,.15); border-radius: 8px; font: inherit;
}
.compose__children { margin-top: 8px; position: relative; }
.compose__child-row { position: relative; display: flex; align-items: center; min-width: 0; height: 28px; }
.compose__slot-hint { font-size: .8rem; color: rgba(57,57,57,.8); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.compose__child-row--connected .compose__slot-hint { color: #0a7; }
</style>