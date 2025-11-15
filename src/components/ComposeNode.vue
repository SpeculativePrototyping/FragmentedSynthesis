<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import type { NodeProps, Edge } from '@vue-flow/core'
import type { ParagraphElement, SectionElement, FigureElement, DocElement } from '../api/docstruct'
import '../styles/docNodes.css'
import type { ComputedRef } from 'vue'


interface ComposeNodeData {
  title?: string
  json?: string
  value?: string
  label?: string
}

const props = defineProps<NodeProps<ComposeNodeData>>()
const { nodes, edges, updateNodeData, updateNodeInternals } = useVueFlow()

// Node-Titel
const title = ref(props.data?.title ?? '')

// Alle eingehenden Edges
const incomingEdges = computed(() => edges.value.filter(edge => edge.target === props.id))

// Wandelt jeden verbundenen TextAreaNode in ein ParagraphElement um
function asParagraph(edge?: Edge): ParagraphElement | undefined {
  if (!edge) return undefined
  const sourceNode = nodes.value.find(n => n.id === edge.source)
  if (!sourceNode?.data) return undefined
  const payload = sourceNode.data as Record<string, unknown>

  const value = payload.value
  const citations = payload.citations as string[] | undefined

  if (typeof value === 'string' && value.trim()) {
    return {
      id: sourceNode.id,
      kind: 'paragraph',
      title: undefined,
      body: value,
      children: [],
      citations,
    }
  }
  return undefined
}


function asFigure(edge?: Edge): FigureElement | undefined {
  if (!edge) return undefined
  const sourceNode = nodes.value.find(n => n.id === edge.source)
  if (!sourceNode?.data) return undefined
  const payload = sourceNode.data as Record<string, unknown>

  const imageName = payload.imageName as string | undefined
  const latexLabel = payload.latexLabel as string | undefined
  const refLabel = payload.refLabel as string | undefined        // <- richtig
  const citations = payload.citations as string[] | undefined  // <-- übernehmen

  if (typeof imageName === 'string' && imageName.trim()) {
    return {
      id: sourceNode.id,
      kind: 'figure',
      imageName: imageName.trim(),
      latexLabel: latexLabel?.trim() ?? '',
      refLabel: refLabel ?? '',
      children: [],
      citations: citations ?? [],
    }
  }
  return undefined
}




// Paragraphen sammeln
const childParagraphs = computed(() =>
    incomingEdges.value
        .map(edge => asParagraph(edge))
        .filter((p): p is ParagraphElement => !!p)
)

const childElements = computed<DocElement[]>(() => {
  const elements: DocElement[] = []

  for (const edge of incomingEdges.value) {
    const para = asParagraph(edge)
    if (para) elements.push(para)
    const fig = asFigure(edge)
    if (fig) elements.push(fig)
  }

  return elements
})

// JSON-Payload für DocOutput
const docPayload = computed<SectionElement>(() => ({
  id: props.id,
  kind: 'section',  // alles als section für DocOutput
  level: 1,
  title: title.value || undefined,
  body: undefined,
  children: childElements.value, // <- jetzt hier die neuen Kinder
}))

// HandleRows für Template
interface HandleRow {
  handleId: string
  connected: boolean
  preview: string
  type: 'paragraph' | 'figure'
}

const handleRows = computed<HandleRow[]>(() => {
  const rows: HandleRow[] = []

  incomingEdges.value.forEach((edge, index) => {
    const paragraph = asParagraph(edge)
    const figure = asFigure(edge)

    if (paragraph) {
      rows.push({
        handleId: `child-${index}`,
        connected: true,
        preview: paragraph.body?.split(/\s+/).slice(0, 6).join(' ') ?? '',
        type: 'paragraph',
      })
    } else if (figure) {
      rows.push({
        handleId: `child-${index}`,
        connected: true,
        preview: figure.latexLabel ?? '',
        type: 'figure',
      })
    }
  })

  // zusätzlicher leerer Handle
  rows.push({
    handleId: `child-${rows.length}`,
    connected: false,
    preview: '',
    type: 'paragraph',
  })

  return rows
})


let lastJson = ''
watch([incomingEdges, title], () => {
  const json = JSON.stringify(docPayload.value)
  if (json !== props.data?.json) {
    updateNodeData(props.id, {
      ...props.data,
      title: title.value,
      json,
      value: json,
    })

    nextTick(() => updateNodeInternals?.([props.id]))
  }
}, { deep: true })




</script>


<template>
  <div class="compose doc-node">
    <header class="doc-node__header">
      <strong>{{ props.data?.label ?? 'Text' }}</strong>
      <span class="doc-node__hint">aggregates paragraphs to sections</span>
    </header>

    <section class="doc-node__body compose__form">
      <label>
        Section Title
        <input v-model="title" type="text" placeholder="Title" />
      </label>
    </section>

    <section v-if="handleRows.length" class="compose__children doc-node__body">
      <div
        v-for="row in handleRows"
        :key="row.handleId"
        class="doc-node__row"
        :class="{ 'doc-node__row--connected': row.connected }"
      >
        <div class="doc-node__preview" :title="row.preview || 'Attach child...'">
          <span v-if="row.type === 'paragraph'">
            {{row.preview || 'Connect paragraph or figure...' }}
          </span>
          <span v-else-if="row.type === 'figure'">
            📷 {{row.preview || 'Connect figure...' }}
          </span>
        </div>
        <Handle
          :id="row.handleId"
          type="target"
          :position="Position.Left"
          :style="{
            // top: row.handleTop,
            left: '-12px',
            transform: 'translate(-50%, -50%)' }"
        />
      </div>
    </section>

    <Handle id="out" type="source" :position="Position.Right" />
  </div>
</template>

<style scoped>


.compose {
  box-sizing: border-box;
  inline-size: min(36rem, 90%);
  width: 260px;
}

.compose__form {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 8px;
}

.compose__form label {
  display: grid;
  gap: 4px;
  font-size: 0.9rem;
}

.compose__form input,
.compose__form select {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border: 1px solid rgba(15, 23, 42, 0.15);
  border-radius: 8px;
  font: inherit;
}

.compose__children {
  margin-top: 8px;
  position: relative;
}
</style>
