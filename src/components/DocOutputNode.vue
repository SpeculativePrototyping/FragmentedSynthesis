<script setup lang="ts">
import {computed, nextTick, watch, watchEffect, inject, type Ref, ref, onMounted, onBeforeUnmount} from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import type { Edge, NodeProps } from '@vue-flow/core'
import type { DocElement, ParagraphElement, FigureElement, SectionElement } from '../api/docstruct'
import { renderToLatex } from '../api/docstruct'
import '../styles/docNodes.css'
import type {BibEntry} from "@/App.vue";
import JSZip from "jszip"
import {NodeToolbar} from "@vue-flow/node-toolbar";



interface DocOutputNodeData {
  json?: string
  value?: string
  bibliography?: BibEntry[]
  label?: string
  width?: number
  height?: number
}

interface OutlineItem {
  id: string
  label: string
  depth: number
  type: DocElement['kind'] | 'bibliography' | 'reference'
}

interface HandleRow {
  handleId: string
  handleTop: string
  connected: boolean
  preview: string
}

interface ImageCacheEntry {
  base64: string
  refLabel: string
}

type ImageCache = Record<string, ImageCacheEntry>


let lastJson = ''

const props = defineProps<NodeProps<DocOutputNodeData>>()
const { nodes, edges, updateNodeInternals, removeEdges, updateNodeData, removeNodes } = useVueFlow()
const incomingEdges = computed(() => edges.value.filter((edge) => edge.target === props.id))
const bibliography = inject<Ref<BibEntry[]>>('bibliography', ref([]))
const outlineItemsWithBibliography = computed(() => [...outlineItems.value, ...bibliographyItems.value])
const imageCache = inject<Ref<ImageCache>>('imageCache')
const nodeRef = ref<HTMLElement | null>(null)
let resizeObs: ResizeObserver | null = null
let resizeRaf: number | null = null

const handleRows = computed<HandleRow[]>(() => {
  // 1. Alle existierenden Edges auf Indices prüfen
  const indices = incomingEdges.value.map(edge => parseHandleIndex(edge.targetHandle))
  const maxIndex = Math.max(-1, ...indices)

  // 2. totalRows = maxIndex + 2 (alle existierenden + 1 leerer Handle)
  const totalRows = maxIndex + 2

  const rows: HandleRow[] = []

  for (let index = 0; index < totalRows; index++) {
    const matchingEdge = incomingEdges.value.find(edge => parseHandleIndex(edge.targetHandle) === index)

    rows.push({
      handleId: `doc-${index}`,
      handleTop: `${((index + 0.5) / totalRows) * 100}%`,
      connected: Boolean(matchingEdge), // sofort true bei vorhandener Verbindung
      preview: matchingEdge ? describeDoc(edgeToDoc(matchingEdge)) : '',
    })
  }

  return rows
})

const outlineItems = computed(() => {
  const items: OutlineItem[] = []
  for (const doc of topLevelDocs.value) {
    buildOutline(doc, 1, items)
  }
  return items
})

const topLevelDocs = computed(() =>
    incomingEdges.value
        .slice()
        .sort((a, b) => parseHandleIndex(a.targetHandle) - parseHandleIndex(b.targetHandle))
        .map((edge) => edgeToDoc(edge))
        .filter((doc): doc is DocElement => Boolean(doc)),
)

const outlineText = computed(() =>
    outlineItems.value.map((item) => `${'  '.repeat(item.depth)}${item.label}`).join('\n'),
)

const latexSource = computed(() => {
  if (!topLevelDocs.value.length && !(bibliography?.value.length ?? 0)) {
    return ''
  }
  return renderToLatex(topLevelDocs.value, {
    includeDocument: true,
    bibliography: bibliography?.value,
    bibFilename: 'references.bib',
  })
})


const bibliographyItems = computed<OutlineItem[]>(() => {
  const items: OutlineItem[] = []
  const bib = bibliography?.value ?? []
  if (!bib.length) return items

  items.push({
    id: 'bibliography-root',
    label: 'Bibliography',
    depth: 0,
    type: 'bibliography'
  })

  bib.forEach((entry, index) => {
    const authors = entry.fields?.author?.split(/ and /i).map(a => a.trim()).join('; ') ?? ''
    const year = entry.fields?.year ?? 'n.d.'
    const title = entry.fields?.title ?? '(no title)'

    items.push({
      id: `bib-${index}`,
      label: `${authors} (${year}). ${title}`,
      depth: 1,
      type: 'reference'
    })
  })

  return items
})

//Functions

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
      // fall through
    }
  }

  const value = payload.value
  if (typeof value === 'string' && value.trim()) {
    return promoteStringToParagraph(edge.source, value.trim())
  }

  return undefined
}


function describeDoc(doc?: DocElement): string {
  if (!doc) return ''

  switch (doc.kind) {
    case 'section':
      return doc.title?.trim() || 'Untitled section'
    case 'paragraph':
      return doc.body?.trim()?.split(/\s+/).slice(0, 10).join(' ') || 'Paragraph'
    case 'figure':
      return doc.latexLabel ?? 'Figure'
    default:
      const _exhaustiveCheck: never = doc
      return _exhaustiveCheck
  }
}


function buildOutline(doc: DocElement, currentSectionLevel: number, acc: OutlineItem[]): void {

  //
  // SECTION
  //
  if (doc.kind === 'section') {

    // Level kommt direkt aus dem ComposeNode-JSON
    const level = (doc as any).level ?? currentSectionLevel ?? 1

    // Abschnitt-Einrückung
    const depth = Math.max(0, level - 1)

    acc.push({
      id: doc.id,
      label: doc.title?.trim() || 'Untitled section',
      depth,
      type: 'section',
    })

    // Für Kinder gilt ab jetzt dieses Level
    for (const child of doc.children) {
      buildOutline(child, level, acc)
    }

    return
  }

  //
  // PARAGRAPH + FIGURE (gleicher Depth!)
  //
  if (doc.kind === 'paragraph' || doc.kind === 'figure') {

    // Beide sollen identisch behandelt werden:
    const depth = Math.max(0, currentSectionLevel)

    const label =
        doc.kind === 'paragraph'
            ? (doc.body?.trim()?.split(/\s+/).slice(0, 12).join(' ') || 'Paragraph')
            : (doc.latexLabel || 'Figure')

    acc.push({
      id: doc.id,
      label,
      depth,
      type: doc.kind,
    })

    return
  }
}


function downloadLatex() {
  if (!latexSource.value) return
  const blob = new Blob([latexSource.value], { type: 'text/x-tex' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'main.tex'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function onExport() {
  if (!latexSource.value) return
  downloadLatex()
}

function downloadBib() {
  const bib = bibliography?.value ?? []
  if (!bib.length) return

  // alle raw-Einträge zusammenfügen
  const content = bib.map(entry => entry.raw?.trim() ?? '').join('\n\n')
  if (!content) return

  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'references.bib'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function changeSectionLevel(sectionId: string, delta: number) {
  // Finde das Edge, das diese Section liefert
  const edge = incomingEdges.value.find(e => edgeToDoc(e)?.id === sectionId)
  if (!edge) return

  // Finde den SourceNode (ComposeNode)
  const sourceNode = nodes.value.find(n => n.id === edge.source)
  if (!sourceNode?.data?.json) return

  try {
    const doc: SectionElement = JSON.parse(sourceNode.data.json)

    // Level anpassen, aber auf 1..3 begrenzen
    const newLevel = Math.min(3, Math.max(1, (doc.level ?? 1) + delta))
    doc.level = newLevel

    // Node-Daten updaten (ComposeNode JSON wird überschrieben)
    updateNodeData(sourceNode.id, {
      ...sourceNode.data,
      json: JSON.stringify(doc),
    })

    // VueFlow intern aktualisieren
    nextTick(() => updateNodeInternals?.([sourceNode.id]))
  } catch (err) {
    console.error("Failed to change section level:", err)
  }
}


async function downloadZip() {
  const tex = latexSource.value
  const bibEntries = bibliography?.value ?? []
  const images = imageCache?.value ?? {}

  if (!tex && !bibEntries.length && Object.keys(images).length === 0) return

  const zip = new JSZip()

  //
  // ---- main.tex ----
  //
  if (tex) {
    zip.file("main.tex", tex)
  }

  //
  // ---- references.bib ----
  //
  if (bibEntries.length) {
    const bibContent = bibEntries
        .map(entry => entry.raw?.trim() ?? "")
        .filter(Boolean)
        .join("\n\n")

    if (bibContent.trim()) {
      zip.file("references.bib", bibContent)
    }
  }

  //
  // ---- images/ folder ----
  //
  const imgFolder = zip.folder("images")

  for (const [key, entry] of Object.entries(images)) {
    // entry.base64 = "data:image/png;base64,AAAA..."
    const base64 = entry.base64
    const matches = base64.match(/^data:(.*?);base64,(.*)$/)

    if (!matches) continue

    const mime = matches[1]           // z.B. "image/png"
    const b64data = matches[2]

    // Dateiendung bestimmen
    let ext = "png"
    if (mime.includes("jpeg")) ext = "jpg"
    if (mime.includes("svg")) ext = "svg"
    if (mime.includes("pdf")) ext = "pdf"

    imgFolder.file(`${key}`, b64data, { base64: true })
  }

  //
  // ---- ZIP generieren ----
  //
  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE"
  })

  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = "latex-project.zip"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

async function onOpenInOverleaf() {
  const { blob, base64 } = await createLatexZipBlob(
      latexSource.value,
      bibliography?.value ?? [],
      imageCache?.value ?? {}
  );
  openInOverleafWithZip(base64);
}

function openInOverleafWithZip(b64zip: string) {
  // MIME für ZIP
  const dataUri = `data:application/zip;base64,${b64zip}`;

  const form = document.createElement("form");
  form.action = "https://www.overleaf.com/docs";
  form.method = "POST";
  form.target = "_blank";

  const input = document.createElement("input");
  input.type = "hidden";
  input.name = "snip_uri";
  input.value = dataUri;

  form.appendChild(input);

  // Optional: main_document
  const mainDoc = document.createElement("input");
  mainDoc.type = "hidden";
  mainDoc.name = "main_document";
  mainDoc.value = "main.tex";
  form.appendChild(mainDoc);

  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
}


async function createLatexZipBlob(tex: string, bibEntries: BibEntry[], images: Record<string, { base64: string }>) {
  const zip = new JSZip();

  // tex
  zip.file("main.tex", tex);

  // bib
  if (bibEntries.length) {
    const bib = bibEntries
        .map(e => e.raw?.trim() ?? "")
        .filter(Boolean)
        .join("\n\n");
    zip.file("references.bib", bib);
  }

  // images
  const imgFolder = zip.folder("images");
  for (const [key, entry] of Object.entries(images)) {
    // Base64-String „data:image/...;base64,...“
    const matches = entry.base64.match(/^data:(.*?);base64,(.*)$/);
    if (!matches) continue;
    const mime = matches[1];
    const b64 = matches[2];
    let ext = "png";
    if (mime.includes("jpeg")) ext = "jpg";
    else if (mime.includes("svg")) ext = "svg";
    else if (mime.includes("pdf")) ext = "pdf";

    imgFolder.file(`${key}.${ext}`, b64, { base64: true });
  }

  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  const base64 = await zip.generateAsync({ type: "base64", compression: "DEFLATE" });

  return { blob, base64 };
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



// Watchers:
watch(bibliography, () => {
  updateNodeData(props.id, { ...props.data })
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


watchEffect(() => {
  const docs = topLevelDocs.value
  const json = JSON.stringify(docs)
  if (json === lastJson && props.data?.json === json) return
  lastJson = json
  updateNodeData(props.id, { ...props.data, json, value: outlineText.value })
})

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
    </div>
  </NodeToolbar>
  <div class="doc-output doc-node" ref="nodeRef">
    <header class="doc-node__header">
      <strong>{{ props.data?.label ?? 'Text' }}</strong>
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

      <div class="doc-output__outline" role="tree" @wheel.stop>
        <div v-if="!outlineItems.length && !bibliographyItems.length" class="doc-output__empty">
          Attach sections or paragraphs to get a preview of your document and take a look at the outline.
        </div>

        <div
            v-for="item in outlineItemsWithBibliography"
            :key="item.id"
            class="doc-output__item"
            :class="{
            'doc-output__item--section': item.type === 'section',
            'doc-output__item--paragraph': item.type === 'paragraph',
            'doc-output__item--bibliography': item.type === 'bibliography',
            'doc-output__item--nested': item.depth > 0,
            'doc-output__item--reference': item.type === 'reference',
            'doc-output__item--figure': item.type === 'figure',
          }"
            :style="{ '--outline-depth': item.depth }"
            role="treeitem"
            :aria-level="item.depth + 1"
        >
          <span class="doc-output__marker" />
          <span class="doc-output__level-label">
     {{ item.type === 'section'
              ? ['Section','Subsection','Subsubsection'][item.depth] || 'Section'
              : item.type === 'paragraph'
                  ? 'Paragraph'
                  : item.type === 'figure'
                      ? 'FIGURE'
                      : item.type === 'bibliography'
                          ? 'Bibliography'
                          : item.type === 'reference'
                              ? 'Reference'
                              : '' }}
          </span>
          <span class="doc-output__label" :class="{ 'doc-output__label--muted': item.type === 'paragraph' && item.depth === 1 }">
            {{ item.label }}
          </span>
          <div v-if="item.type === 'section'" class="doc-output__level-controls">
            <button class="doc-output__level-btn" @click="changeSectionLevel(item.id, -1)" title="Promote this section">←</button>
            <button class="doc-output__level-btn" @click="changeSectionLevel(item.id, +1)" title="Demote this section">→</button>
          </div>
        </div>
      </div>

      <button type="button" class="doc-output__export" :disabled="!latexSource" @click="onExport">
        Export .tex
      </button>
      <button type="button" class="doc-output__export"
              :disabled="!bibliography?.length"
              @click="downloadBib">
        Export .bib
      </button>
      <button
          type="button"
          class="doc-output__export"
          :disabled="!latexSource && !(bibliography?.length)"
          @click="downloadZip"
      >
        Export Project as .zip
      </button>
      <button
          type="button"
          class="doc-output__export"
          :disabled="!latexSource && !(bibliography?.length)"
          @click="onOpenInOverleaf"
      >
        Open Project in Overleaf
      </button>

    </section>
    <Handle id="out" type="source" :position="Position.Right" />
  </div>
</template>

<style scoped>

.doc-output {
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
  pointer-events: auto; }

.doc-output__outline {
  min-width: 400px;
  min-height: 400px;
  width: 400px;
  height: 400px;
  overflow: auto;
  padding: 12px 14px;
  border: 1px solid rgba(15,23,42,0.12);
  border-radius: 10px;
  background-color: #f8fafc;
  display: flex;
  flex-direction: column;
  gap: 6px;
  resize: both;
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
  border-left: 1px solid rgba(15,23,42,0.12);
}

.doc-output__marker {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  flex-shrink: 0;
  background-color: rgba(79,70,229,0.6);
}

.doc-output__item--paragraph .doc-output__marker {
  background-color: rgba(45,212,191,0.6);
}

.doc-output__item--bibliography .doc-output__marker {
  background-color: #ff0000;
}

.doc-output__item--figure .doc-output__marker {
  background-color: #1e3a8a; /* dunkelblau */
}

.doc-output__label {
  flex: 1 1 auto;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.doc-output__level-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #5b21b6;
  margin-right: 6px;
}

.doc-output__item--reference .doc-output__marker {
  background-color: #facc15; /* gelb wie Bibliographie */
}

.doc-output__label--muted {
  color: rgba(15,23,42,0.65);
  font-style: italic;
}

.doc-output__export {
  align-self: flex-end;
  border: 1px solid rgba(15,23,42,0.2);
  border-radius: 6px;
  background: white;
  padding: 6px 12px;
  font-size: 0.85rem;
  cursor: pointer;
}

.doc-output__export:hover {
  background: rgba(99,102,241,0.08);
}

.doc-output__level-controls {
  display: flex;
  gap: 4px;
  margin-left: auto;
}

.doc-output__level-btn {
  border: none;
  background: rgba(79,70,229,0.1);
  color: #4f46e5;
  padding: 2px 6px;
  border-radius: 4px;
  cursor: pointer;
  line-height: 1;
  font-size: 0.75rem;
}
.doc-output__level-btn:hover {
  background: rgba(79,70,229,0.2);
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

.delete-node-btn {
  padding: 4px 8px;
  border-radius: 8px;
  border: 1px solid rgba(15,23,42,.15);
  background-color: #f87171; /* hellrot */
  color: white;
  cursor: pointer;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.delete-node-btn:hover {
  background-color: #dc2626; /* dunkleres Rot bei Hover */
}

</style>
