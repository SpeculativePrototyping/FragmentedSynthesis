<script setup lang="ts">
import {ref, watch, provide, computed, nextTick, onMounted, onUnmounted} from 'vue'
import {type Node, type Edge, type Connection, useVueFlow} from '@vue-flow/core'
import { VueFlow, addEdge } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import SaveRestoreControls from './Controls.vue'
import { findNodeTemplate} from './nodes/templates'
import {MiniMap} from "@vue-flow/minimap";
import {type NodeChange, type EdgeChange} from '@vue-flow/core'
import html2canvas from 'html2canvas'



//Import every node-component:
import TextAreaNode from './components/TextAreaNode.vue'
import TextViewNode from './components/TextViewNode.vue'
import ParaphraseNode from './components/ParaphraseNode.vue'
import ComposeNode from './components/ComposeNode.vue'
import DocOutputNode from './components/DocOutputNode.vue'
import EditNode from './components/EditNode.vue'
import GrammarNode from './components/GrammarNode.vue'
import StickyNote from "@/components/StickyNote.vue";
import FigureNode from "@/components/FigureNode.vue";
import TourGuideNode from './components/TourGuideNode.vue'

const AUTOSAVE_INTERVAL = 60_000 // 60 Sekunden
const MAX_AUTOSAVES = 20


interface EdgeMouseEvent {
  edge: Edge
  event: MouseEvent
}

export interface BibEntry {
  id: string
  type: string
  fields: Record<string, string>
  raw?: string
}

interface ImageCacheEntry {
  base64: string
  refLabel: string
}

interface Snapshot {
  id: string
  name: string
  createdAt: number
  data: any
  screenshot?: string // optional, base64 image
  isAutoSave?: boolean
}

const snapshots = ref<Snapshot[]>([])
provide('snapshots', snapshots)

export type Language = 'en' | 'de'
const language = ref<Language>('en')
provide('language', language)

const nodes = ref<Node[]>([])
const edges = ref<Edge[]>([])

const bibliography = ref<BibEntry[]>([])  // <- global bibliography
provide('bibliography', bibliography)
const updateBibliography = (newBib: BibEntry[]) => {
  bibliography.value = newBib
}
provide('updateBibliography', updateBibliography)

const TLDR = ref(false) // <- for shrinking some nodes
provide('TLDR', TLDR)

const demoActive = ref(false)
provide('demoActive', demoActive)

type ImageCache = Record<string, ImageCacheEntry>
const imageCache = ref<ImageCache>({})
provide('imageCache', imageCache)

const templates = ref([])

provide('styleTemplates', templates)
provide('setStyleTemplates', (newList) => {
  templates.value = newList
})

const screenshotInProgress = ref(false)
provide('screenshotInProgress', screenshotInProgress)


const {addNodes, screenToFlowCoordinate} = useVueFlow()
const { updateEdge, addEdges } = useVueFlow()

const edgeMenu = ref<{
  visible: boolean
  x: number
  y: number
  edge: Edge | null
}>({
  visible: false,
  x: 0,
  y: 0,
  edge: null,
})

let nodeCounter = 0





const allowedSourceTypes = ['textArea', 'grammar', 'paraphrase', 'edit']

function canInsertOnEdge(edge: Edge) {
  const sourceNode = nodes.value.find(n => n.id === edge.source)
  if (!sourceNode) return false
  return allowedSourceTypes.includes(sourceNode.type)
}

function onEdgeClick(event: EdgeMouseEvent) {
  event.event.stopPropagation()
  const edge = event.edge

  // Sicherheits-Check
  if (!canInsertOnEdge(edge)) {
    // Menü wird nicht angezeigt
    return
  }

  edgeMenu.value = {
    visible: true,
    x: event.event.clientX,
    y: event.event.clientY,
    edge,
  }
}

function closeEdgeMenu() {
  edgeMenu.value.visible = false
}


function onConnect(connection: Connection) {
  edges.value = addEdge(
      {
        ...connection,
        animated: true,
        style: { strokeWidth: 4 },
        interactionWidth: 20,
        markerEnd: { type: 'arrowclosed', color: '#000000', width: 6, height: 6,},
      },
      edges.value
  ) as Edge[]
}


function onDrop(event: DragEvent) {
  const type = event.dataTransfer?.getData('node/type')
  if (!type) return

  const template = findNodeTemplate(type)
  if (!template) return

  nodeCounter++
  const id = `node-${nodeCounter}`
  const baseLabel = template?.label ?? `Node ${id}`

  // Copy template data so the original definition stays unchanged.
  const data: Node['data'] =
      template?.data && typeof template.data === 'object'
          ? { ...template.data }
          : { label: baseLabel }

  // Guarantee that the node shows a label if the template forgot to set one.
  if (data && typeof data === 'object' && !('label' in data)) {
    ;(data as Record<string, unknown>).label = baseLabel
  }

  const position = screenToFlowCoordinate({
    x: event.clientX,
    y: event.clientY,
  })

  const newNode: Node = {
    id: `${template?.type ?? 'node'}-${id}`,
    type: template?.type,
    position,
    data,
    dragHandle: '.doc-node__header'
  }
  addNodes([newNode])
}


function onEdgeUpdate({ edge, connection }) {
  updateEdge(edge, connection)
}

function deleteEdge() {
  if (!edgeMenu.value.edge) return

  edges.value = edges.value.filter(
      e => e.id !== edgeMenu.value.edge!.id
  )

  closeEdgeMenu()
}


function insertNodeOnEdge(templateType: string) {
  if (!edgeMenu.value.edge) return;
  const edge = edgeMenu.value.edge;

  const template = findNodeTemplate(templateType);
  if (!template) return;

  const sourceNode = nodes.value.find(n => n.id === edge.source);
  const targetNode = nodes.value.find(n => n.id === edge.target);
  if (!sourceNode || !targetNode) return;

  // Mittige Position zwischen Source und Target
  const newX = (sourceNode.position.x + targetNode.position.x) / 2;
  const newY = (sourceNode.position.y + targetNode.position.y) / 2;

  // Neue Node-ID
  nodeCounter++;
  const newNodeId = `node-${nodeCounter}`;

  // Node aus Template kopieren
  const newNode: Node = {
    id: newNodeId,
    type: template.type,
    position: { x: newX, y: newY },
    data: template.data ? { ...template.data } : { label: template.label },
    dragHandle: '.doc-node__header'
  };

  addNodes([newNode]);

  // Alte Edge löschen
  edges.value = edges.value.filter(e => e.id !== edge.id);

  // Default Handles definieren

  const oldSourceHandle = edge.sourceHandle ?? 'output';
  const oldTargetHandle = edge.targetHandle ?? 'input';

  // Neue Edges erstellen
  const newEdges: Edge[] = [
    {
      id: `edge-${edge.source}-${newNodeId}-${Date.now()}`,
      source: edge.source,
      target: newNodeId,
      sourceHandle: oldSourceHandle,
      targetHandle: 'input', // neuer Node erhält 'input'
      animated: true,
      style: { strokeWidth: 4 },
      markerEnd: { type: 'arrowclosed', color: '#000', width: 6, height: 6 },
    },
    {
      id: `edge-${newNodeId}-${edge.target}-${Date.now()}`,
      source: newNodeId,
      target: edge.target,
      sourceHandle: 'output',   // neuer Node liefert an alte Edge
      targetHandle: oldTargetHandle,
      animated: true,
      style: { strokeWidth: 4 },
      markerEnd: { type: 'arrowclosed', color: '#000', width: 6, height: 6 },
    },
  ];


  edges.value.push(...newEdges);

  closeEdgeMenu();
}


async function createSnapshot() {

  // Blitz starten
  screenshotInProgress.value = true

  // 1. Export der Flow-Daten
  const exportData = {
    nodes: JSON.parse(JSON.stringify(nodes.value)),
    edges: JSON.parse(JSON.stringify(edges.value)),
    bibliography: bibliography.value,
    TLDR: TLDR.value,
    templates: templates.value
  }

  // Optional: nodes enthalten Bilder → Bild-Cache einfügen
  exportData.nodes.forEach((node: any) => {
    if (node.data?.imageName && imageCache.value[node.data.imageName]) {
      node.data.image = imageCache.value[node.data.imageName].base64
    }
  })

  // 2. Screenshot erzeugen
  let screenshot: string | undefined
  try {
    const flowEl = document.querySelector('.vue-flow') as HTMLElement
    if (flowEl) {
      const canvas = await html2canvas(flowEl)
      screenshot = canvas.toDataURL('image/png')
    }
  } catch (err) {
    console.warn('Snapshot screenshot failed', err)
  }

  // Blitz kurz verzögern, damit der Effekt sichtbar ist
  await new Promise(r => setTimeout(r, 150))
  screenshotInProgress.value = false

  // 3. Snapshot speichern
  const timestamp = new Date()
  snapshots.value.unshift({
    id: crypto.randomUUID(),
    name: timestamp.toLocaleString(),
    createdAt: timestamp.getTime(),
    data: exportData,
    screenshot
  })
}

function restoreSnapshot(id: string) {
  const snap = snapshots.value.find(s => s.id === id)
  if (!snap) return

  nodes.value = []
  edges.value = []

  nextTick(() => {
    nodes.value = snap.data.nodes
    edges.value = snap.data.edges
    TLDR.value = snap.data.TLDR
    templates.value = snap.data.templates
    bibliography.value = snap.data.bibliography
  })
}

function deleteSnapshot(id: string) {
  snapshots.value = snapshots.value.filter(s => s.id !== id)
}

provide('createSnapshot', createSnapshot)
provide('restoreSnapshot', restoreSnapshot)
provide('deleteSnapshot', deleteSnapshot)


async function createAutosaveSnapshot() {
  const timestamp = new Date()

  const exportData = {
    nodes: JSON.parse(JSON.stringify(nodes.value)),
    edges: JSON.parse(JSON.stringify(edges.value)),
    bibliography: bibliography.value,
    TLDR: TLDR.value,
    templates: templates.value
  }

  exportData.nodes.forEach((node: any) => {
    if (node.data?.imageName && imageCache.value[node.data.imageName]) {
      node.data.image = imageCache.value[node.data.imageName].base64
    }
  })

  let screenshot: string | undefined
  try {
    const flowEl = document.querySelector('.vue-flow') as HTMLElement
    if (flowEl) {
      const canvas = await html2canvas(flowEl)
      screenshot = canvas.toDataURL('image/png')
    }
  } catch (err) {
    console.warn('Autosave screenshot failed', err)
  }

  // 🔹 neuen Autosave vorne einfügen
  snapshots.value.unshift({
    id: crypto.randomUUID(),
    name: `🕒 Autosave - ${timestamp.toLocaleTimeString()}`,
    createdAt: timestamp.getTime(),
    data: exportData,
    screenshot,
    isAutoSave: true
  })

  // 🔹 alte Autosaves begrenzen (nur Autosaves!)
  const autosaves = snapshots.value.filter(s => s.isAutoSave)

  if (autosaves.length > MAX_AUTOSAVES) {
    const autosavesSorted = autosaves
        .sort((a, b) => a.createdAt - b.createdAt)

    const toRemove = autosavesSorted.slice(
        0,
        autosaves.length - MAX_AUTOSAVES
    )

    snapshots.value = snapshots.value.filter(
        s => !toRemove.some(r => r.id === s.id)
    )
  }
}


let autosaveInterval: number | undefined

onMounted(() => {
  autosaveInterval = window.setInterval(
      createAutosaveSnapshot,
      AUTOSAVE_INTERVAL
  )
})

onUnmounted(() => {
  if (autosaveInterval) clearInterval(autosaveInterval)
})



watch(nodes, (newNodes) => {
  const usedRefLabels = new Set(newNodes
      .filter(n => n.type === 'figure')  // nur Figure Nodes
      .map(n => n.data?.refLabel)
      .filter(Boolean) as string[]
  )

  for (const key in imageCache.value) {
    const cached = imageCache.value[key]
    if (!usedRefLabels.has(cached.refLabel)) {
      delete imageCache.value[key]
      console.log(`Removed unused image from cache: ${key}`)
    }
  }
}, { deep: true })



</script>

<template>
  <div style="width: 100%; height: 100vh">

    <div
        v-if="edgeMenu.visible"
        class="edge-toolbar"
        :style="{ top: `${edgeMenu.y}px`, left: `${edgeMenu.x}px` }"
    >
      <button class="delete-btn" @click="deleteEdge">🗑️</button>
      <button @click="insertNodeOnEdge('edit')">Insert Edit Node</button>
      <button @click="insertNodeOnEdge('paraphrase')">Insert Paraphrase Node</button>
      <button @click="insertNodeOnEdge('grammar')">Insert Grammar Node</button>
    </div>

    <div v-if="screenshotInProgress" class="screenshot-overlay"></div>


    <VueFlow
        v-model:nodes="nodes"
        v-model:edges="edges"
        @connect="onConnect"
        @drop ="onDrop"
        @dragover.prevent
        :edgesUpdatable="true"
        @edge-update="onEdgeUpdate"
        @edge-click="onEdgeClick"
        @pane-click="closeEdgeMenu"
    >
      <SaveRestoreControls />


      <template #node-textArea="textAreaProps">
        <TextAreaNode v-bind="textAreaProps" />
      </template>
      <template #node-textView="textViewProps">
        <TextViewNode v-bind="textViewProps" />
      </template>
      <template #node-paraphrase="paraphraseProps">
        <ParaphraseNode v-bind="paraphraseProps" />
      </template>
      <template #node-compose="composeProps">
        <ComposeNode v-bind="composeProps" />
      </template>
      <template #node-docOutput="docOutputProps">
        <DocOutputNode v-bind="docOutputProps" />
      </template>
      <template #node-edit="editProps">
        <EditNode v-bind="editProps" />
      </template>
      <template #node-grammar="grammarProps">
        <GrammarNode v-bind="grammarProps" />
      </template>
      <template #node-stickyNote="stickyNoteProps">
        <StickyNote v-bind="stickyNoteProps" />
      </template>
      <template #node-referenceTracker="trackerProps">
        <ReferenceTrackerNode v-bind="trackerProps" />
      </template>
      <template #node-figure="figureProps">
        <FigureNode v-bind="figureProps"/>
      </template>
      <template #node-tourGuide="tourGuideProps">
        <TourGuideNode v-bind="tourGuideProps" />
      </template>
      <template #node-figureTracker="figureTrackerProps">
        <FigureTrackerNode v-bind="figureTrackerProps" />
      </template>


      <Background />

      <MiniMap
          zoomable
          pannable
      />
    </VueFlow>

  </div>
</template>


<style>
@import './main.css';

/* import the necessary styles for Vue Flow to work */
@import '@vue-flow/core/dist/style.css';

/* import the default theme, this is optional but generally recommended */
@import '@vue-flow/core/dist/theme-default.css';

/* import default minimap theme */
@import '@vue-flow/minimap/dist/style.css';

/* Hintergrundfarbe der MiniMap */
.vue-flow__minimap {
  background-color: #7c7c7e !important; /* hellgrau */
  border-radius: 8px;
  box-shadow: 0 0 8px rgba(0,0,0,0.1);
}

/* allgemeine Farbe und Umriss der Nodes */
.vue-flow__minimap-node {
  fill: #000000 !important;
  stroke: #000000 !important;
  stroke-width: 1.2;
  rx: 2; /* abgerundete Ecken bei Rechtecken */
}

/* wenn Node ausgewählt ist */
.vue-flow__minimap-node.selected {
  stroke: #000 !important;
  fill: #ff0000 !important; /* helles Gelb für Highlight */
}

.edge-toolbar {
  position: fixed;
  width: 100px;
  z-index: 1000;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  gap: 6px;

  background-color: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(15, 23, 42, 0.08);
  padding: 10px 14px;
  border-radius: 12px;
  box-shadow: 0 4px 14px rgba(0,0,0,0.15);
}

.edge-toolbar button {
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid rgba(15,23,42,.15);
  background-color: rgba(99, 102, 241, 0.3); /* dunkleres Lila */
  color: #000000;
  cursor: pointer;
  width: 100%;
  text-align: center;
  transition: background 0.2s;
}

.edge-toolbar button:hover {
  background-color: rgba(99, 102, 241, 0.5); /* etwas dunkler beim Hover */
}

/* Nur der Löschen-Button */
.edge-toolbar .delete-btn {
  background-color: #f87171; /* hellrot */
}

.edge-toolbar .delete-btn:hover {
  background-color: #dc2626; /* dunkleres Rot beim Hover */
}

/* Screenshot flash */
.screenshot-overlay {
  position: fixed;
  inset: 0;
  background: white;
  opacity: 0.9;
  z-index: 99999; /* über allem */
  pointer-events: none;
  animation: flash 0.3s ease-in-out;
}

@keyframes flash {
  0% { opacity: 0; }
  50% { opacity: 1; }
  100% { opacity: 0; }
}


</style>
