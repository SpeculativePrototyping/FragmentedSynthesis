<script setup lang="ts">
import { computed, nextTick, ref, watch, watchEffect } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import type { Edge, NodeProps } from '@vue-flow/core'
import type { DocElement, SectionElement } from '../api/docstruct'
import '../styles/docNodes.css'

const SECTION_CHOICES = ['section', 'subsection', 'subsubsection'] as const
const SECTION_LEVEL: Record<(typeof SECTION_CHOICES)[number], SectionElement['level']> = {
  section: 1,
  subsection: 2,
  subsubsection: 3,
}

type SectionChoice = (typeof SECTION_CHOICES)[number]

interface ComposeNodeData {
  sectionType?: SectionChoice
  title?: string
  json?: string
  kind?: string
  level?: number
  value?: string
}

const props = defineProps<NodeProps<ComposeNodeData>>()
const { nodes, edges, updateNodeData, updateNodeInternals, removeEdges } = useVueFlow()

const sectionType = ref<SectionChoice>(
  (props.data?.sectionType as SectionChoice) || (props.data?.kind as SectionChoice) || 'section',
)
const title = ref(props.data?.title ?? '')

const sectionLevel = computed<SectionElement['level']>(() => SECTION_LEVEL[sectionType.value] ?? 1)

const incomingEdges = computed(() => edges.value.filter((edge) => edge.target === props.id))

function parseHandleIndex(handleId?: Edge['targetHandle']): number {
  if (!handleId) return -1
  const [, raw] = String(handleId).split('-')
  const parsed = Number.parseInt(raw ?? '', 10)
  return Number.isFinite(parsed) ? parsed : -1
}

function asDocElement(edge?: Edge): DocElement | undefined {
  if (!edge) return undefined
  const sourceNode = nodes.value.find((node) => node.id === edge.source)
  if (!sourceNode?.data) return undefined
  const payload = sourceNode.data as Record<string, unknown>

  const rawJson = payload.json
  if (typeof rawJson === 'string' && rawJson) {
    try {
      return JSON.parse(rawJson) as DocElement
    } catch {
      // fall through to string handling
    }
  }

  const value = payload.value
  if (typeof value === 'string' && value.trim()) {
    return {
      id: `${sourceNode.id}-paragraph`,
      kind: 'paragraph',
      title: undefined,
      body: value,
      children: [],
    }
  }

  return undefined
}

const childDocs = computed(() =>
  incomingEdges.value
    .slice()
    .sort((a, b) => parseHandleIndex(a.targetHandle) - parseHandleIndex(b.targetHandle))
    .map((edge) => asDocElement(edge))
    .filter((doc): doc is DocElement => Boolean(doc)),
)

interface HandleRow {
  handleId: string
  handleTop: string
  connected: boolean
  preview: string
}

function describeDoc(doc?: DocElement): string {
  if (!doc) return ''
  if (doc.kind === 'section') {
    return doc.title?.trim() || `Section (level ${doc.level})`
  }
  if (doc.kind === 'paragraph') {
    return (doc.body ?? '').trim().split(/\s+/).slice(0, 6).join(' ')
  }
  return doc.kind
}

const handleRows = computed<HandleRow[]>(() => {
  const indices = incomingEdges.value.map((edge) => parseHandleIndex(edge.targetHandle))
  const maxIndex = Math.max(-1, ...indices)
  const totalRows = maxIndex + 2

  const rows: HandleRow[] = []
  for (let index = 0; index < totalRows; index += 1) {
    const matchingEdge = incomingEdges.value.find(
      (edge) => parseHandleIndex(edge.targetHandle) === index,
    )

    rows.push({
      handleId: `child-${index}`,
      handleTop: `${((index + 0.5) / totalRows) * 100}%`,
      connected: Boolean(matchingEdge),
      preview: describeDoc(asDocElement(matchingEdge)),
    })
  }

  return rows
})

watch(
  handleRows,
  async (rows) => {
    await nextTick()
    updateNodeInternals?.([props.id])

    const validHandles = new Set(rows.map((row) => row.handleId))
    const stale = incomingEdges.value.filter((edge) => {
      const handleId = edge.targetHandle ?? ''
      return !validHandles.has(handleId)
    })

    if (stale.length) {
      removeEdges(stale)
    }
  },
  { deep: true },
)

const docPayload = computed<SectionElement>(() => ({
  id: props.id,
  kind: 'section',
  level: sectionLevel.value,
  title: title.value || undefined,
  body: undefined,
  children: childDocs.value,
}))

let lastJson = ''

watchEffect(() => {
  const doc = docPayload.value
  const json = JSON.stringify(doc)
  if (json === lastJson && props.data?.json === json) {
    return
  }

  lastJson = json
  updateNodeData(props.id, {
    ...props.data,
    sectionType: sectionType.value,
    kind: 'section',
    level: doc.level,
    title: doc.title ?? '',
    json,
    value: json,
  })
})
</script>

<template>
  <div class="compose doc-node">
    <header class="doc-node__header">
      <strong>Compose</strong>
      <span class="doc-node__hint">Author a document section</span>
    </header>

    <section class="doc-node__body compose__form">
      <label>
        Section Type
        <select v-model="sectionType">
          <option v-for="choice in SECTION_CHOICES" :key="choice" :value="choice">
            {{ choice }}
          </option>
        </select>
      </label>

      <label>
        Title
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
          {{ row.preview || 'Connect elements...' }}
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
