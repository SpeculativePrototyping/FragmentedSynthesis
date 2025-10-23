<script setup lang="ts">
import { computed, nextTick, watch, watchEffect } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import type { Edge, NodeProps } from '@vue-flow/core'
import type { DocElement, ParagraphElement } from '../api/docstruct'
import { renderToLatex } from '../api/docstruct'
import '../styles/docNodes.css'

interface DocOutputNodeData {
  json?: string
  value?: string
}

const props = defineProps<NodeProps<DocOutputNodeData>>()
const { nodes, edges, updateNodeInternals, removeEdges, updateNodeData } = useVueFlow()

const incomingEdges = computed(() => edges.value.filter((edge) => edge.target === props.id))

function parseHandleIndex(handleId?: Edge['targetHandle']): number {
  if (!handleId) return -1
  const [, raw] = String(handleId).split('-')
  const parsed = Number.parseInt(raw ?? '', 10)
  return Number.isFinite(parsed) ? parsed : -1
}

function promoteStringToParagraph(id: string, text: string): ParagraphElement {
  return {
    id: `${id}-paragraph`,
    kind: 'paragraph',
    title: undefined,
    body: text,
    children: [],
  }
}

function edgeToDoc(edge?: Edge): DocElement | undefined {
  if (!edge) return undefined
  const source = nodes.value.find((node) => node.id === edge.source)
  if (!source?.data) return undefined

  const payload = source.data as Record<string, unknown>
  const rawJson = payload.json
  if (typeof rawJson === 'string' && rawJson.trim()) {
    try {
      return JSON.parse(rawJson) as DocElement
    } catch {
      // fall through to value handling
    }
  }

  const value = payload.value
  if (typeof value === 'string' && value.trim()) {
    return promoteStringToParagraph(edge.source, value.trim())
  }

  return undefined
}

const topLevelDocs = computed(() =>
  incomingEdges.value
    .slice()
    .sort((a, b) => parseHandleIndex(a.targetHandle) - parseHandleIndex(b.targetHandle))
    .map((edge) => edgeToDoc(edge))
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
    const title = doc.title?.trim() || 'Untitled section'
    return `${title} (level ${doc.level})`
  }
  if (doc.kind === 'paragraph') {
    const text = doc.body?.trim() ?? ''
    return text ? text.split(/\s+/).slice(0, 10).join(' ') : 'Paragraph'
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
      handleId: `doc-${index}`,
      handleTop: `${((index + 0.5) / totalRows) * 100}%`,
      connected: Boolean(matchingEdge),
      preview: describeDoc(edgeToDoc(matchingEdge)),
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
  { deep: true, immediate: true },
)

interface OutlineItem {
  id: string
  label: string
  depth: number
  type: DocElement['kind']
}

function buildOutline(doc: DocElement, depth: number, acc: OutlineItem[]): void {
  if (doc.kind === 'section') {
    const label = doc.title?.trim() || 'Untitled section'
    acc.push({ id: doc.id, label, depth, type: doc.kind })
    for (const child of doc.children) {
      buildOutline(child, depth + 1, acc)
    }
    return
  }

  if (doc.kind === 'paragraph') {
    const snippet = doc.body?.trim() ?? ''
    const label = snippet ? snippet.split(/\s+/).slice(0, 12).join(' ') : 'Paragraph'
    acc.push({ id: doc.id, label, depth, type: doc.kind })
    return
  }

  acc.push({ id: doc.id, label: doc.kind, depth, type: doc.kind })
}

const outlineItems = computed(() => {
  const items: OutlineItem[] = []
  for (const doc of topLevelDocs.value) {
    buildOutline(doc, 0, items)
  }
  return items
})

const outlineText = computed(() =>
  outlineItems.value.map((item) => `${'  '.repeat(item.depth)}${item.label}`).join('\n'),
)

const latexSource = computed(() => {
  if (!topLevelDocs.value.length) {
    return ''
  }
  return renderToLatex(topLevelDocs.value, { includeDocument: true })
})

let lastJson = ''

watchEffect(() => {
  const docs = topLevelDocs.value
  const json = JSON.stringify(docs)
  if (json === lastJson && props.data?.json === json) {
    return
  }

  lastJson = json
  updateNodeData(props.id, {
    ...props.data,
    json,
    value: outlineText.value,
  })
})

function downloadLatex() {
  if (!latexSource.value) {
    return
  }

  const blob = new Blob([latexSource.value], { type: 'text/x-tex' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'document.tex'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function onExport() {
  if (!latexSource.value) {
    console.info('Nothing to export yet.')
    return
  }

  downloadLatex()
}
</script>

<template>
  <div class="doc-output doc-node">
    <header class="doc-node__header">
      <strong>Document Output</strong>
      <span class="doc-node__hint">Aggregates composed sections</span>
    </header>

    <section class="doc-node__body doc-output__body">
      <div class="doc-output__handles" aria-hidden="true">
        <Handle
          v-for="row in handleRows"
          :key="row.handleId"
          :id="row.handleId"
          type="target"
          :position="Position.Left"
          :style="{ top: row.handleTop, left: '-12px', transform: 'translate(-50%, -50%)' }"
        />
      </div>

      <div class="doc-output__outline" role="tree">
        <div v-if="!outlineItems.length" class="doc-output__empty">Attach sections or paragraphs to preview.</div>
        <div
          v-for="item in outlineItems"
          :key="item.id"
          class="doc-output__item"
          :class="{
            'doc-output__item--section': item.type === 'section',
            'doc-output__item--paragraph': item.type === 'paragraph',
            'doc-output__item--nested': item.depth > 0,
          }"
          :style="{ '--outline-depth': item.depth }"
          role="treeitem"
          :aria-level="item.depth + 1"
        >
          <span class="doc-output__marker" />
          <span class="doc-output__label" :class="{ 'doc-output__label--muted': item.type === 'paragraph' }">
            {{ item.label }}
          </span>
        </div>
      </div>

      <button type="button" class="doc-output__export" :disabled="!latexSource" @click="onExport">
        Export to LaTeX
      </button>
    </section>
    <Handle id="out" type="source" :position="Position.Right" />
  </div>
</template>

<style scoped>
.doc-output {
  width: 340px;
  min-height: 320px;
}

.doc-output__body {
  position: relative;
  gap: 12px;
}

.doc-output__handles {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.doc-output__handles :deep(.vue-flow__handle) {
  pointer-events: auto;
}

.doc-output__outline {
  min-height: 200px;
  max-height: 360px;
  overflow: auto;
  padding: 12px 14px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 10px;
  background-color: #f8fafc;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.doc-output__empty {
  color: rgba(15, 23, 42, 0.55);
  font-size: 0.9rem;
}

.doc-output__item {
  --outline-depth: 0;
  position: relative;
  padding-left: calc(var(--outline-depth) * 20px + 12px);
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.92rem;
  color: #1f2937;
}

.doc-output__item--nested::before {
  content: '';
  position: absolute;
  left: calc(var(--outline-depth) * 20px - 8px);
  top: 0;
  bottom: 0;
  border-left: 1px solid rgba(15, 23, 42, 0.12);
}

.doc-output__marker {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background-color: rgba(79, 70, 229, 0.6);
  flex-shrink: 0;
}

.doc-output__item--paragraph .doc-output__marker {
  background-color: rgba(45, 212, 191, 0.6);
}

.doc-output__label {
  flex: 1 1 auto;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.doc-output__label--muted {
  color: rgba(15, 23, 42, 0.65);
  font-style: italic;
}

.doc-output__export {
  align-self: flex-end;
  border: 1px solid rgba(15, 23, 42, 0.2);
  border-radius: 6px;
  background: white;
  padding: 6px 12px;
  font-size: 0.85rem;
  cursor: pointer;
}

.doc-output__export:hover {
  background: rgba(99, 102, 241, 0.08);
}
</style>
