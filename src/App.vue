<script setup lang="ts">
import {ref, watch, provide, computed, nextTick, onMounted, onUnmounted} from 'vue'
import {type Node, type Edge, type Connection, useVueFlow, Panel} from '@vue-flow/core'
import { VueFlow, addEdge } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import {MiniMap} from "@vue-flow/minimap";


import SaveRestoreControls from './Controls.vue'
import { findNodeTemplate} from './nodes/templates'


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

//Interfaces for globally provided data:

export interface BibEntry {
  id: string
  type: string
  fields: Record<string, string>
  raw?: string
}

export interface ImageCacheEntry {
  base64: string
  refLabel: string
  latexLabel?: string
}

export interface Snapshot {
  id: string
  name: string
  createdAt: number
  data: any
  screenshot?: string // optional, base64 image
  isAutoSave?: boolean
}

export interface StyleTemplate {
  templateName: string
  tone: string
  sectionLength: number
  emphasizePoints: string
}

export interface ZipFileEntry {
  path: string
  type: 'tex' | 'bib' | 'image' | 'other'
  content: string | ArrayBuffer
}


interface EdgeMouseEvent {
  edge: Edge
  event: MouseEvent
}

//Globally provided data:

const snapshots = ref<Snapshot[]>([])
provide('snapshots', snapshots)

export type Language = 'en' | 'de'
const language = ref<Language>('en')
provide('language', language)

const nodes = ref<Node[]>([])
const edges = ref<Edge[]>([])
provide('nodes', nodes)
provide('edges', edges)

const bibliography = ref<BibEntry[]>([])  // <- global bibliography
provide('bibliography', bibliography)
const updateBibliography = (newBib: BibEntry[]) => {bibliography.value = newBib}
provide('updateBibliography', updateBibliography)

const TLDR = ref(false) // <- for shrinking some nodes
provide('TLDR', TLDR)

const demoActive = ref(false)
provide('demoActive', demoActive)

export type ImageCache = Record<string, ImageCacheEntry>
const imageCache = ref<ImageCache>({})
provide('imageCache', imageCache)

const templates = ref([])

provide('styleTemplates', templates)
provide('setStyleTemplates', (newList) => {
  templates.value = newList
})

const snapshotInProgress = ref(false)
provide('snapshotInProgress', snapshotInProgress)

const designMode = ref<'standard' | 'disco'>('standard')
provide('designMode', designMode)
let discoInterval: number | undefined


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

const canInsertNodes = computed(() => {
  if (!edgeMenu.value.edge) return false
  const sourceNode = nodes.value.find(n => n.id === edgeMenu.value.edge!.source)
  if (!sourceNode) return false
  return allowedSourceTypes.includes(sourceNode.type)
})


function onEdgeClick(event: EdgeMouseEvent) {
  event.event.stopPropagation() // das eigentliche MouseEvent
  const edge = event.edge

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

function startDiscoEdges() {
  // Sicherheit: kein doppeltes Interval
  if (discoInterval) return

  discoInterval = window.setInterval(() => {
    edges.value = edges.value.map(edge => {
      const hue = Math.floor(Math.random() * 360)
      const color = `hsl(${hue}, 100%, 50%)`

      return {
        ...edge,
        style: {
          ...(edge.style ?? {}),
          stroke: color,
          strokeWidth: 4,
          transition: 'stroke 0.4s linear',
        },
        markerEnd: {
          ...(edge.markerEnd ?? {}),
          color,
        },
      }
    })
  }, 400) // 🎛️ Tempo (300–600ms fühlt sich gut an)
}


function stopDiscoEdges() {
  if (!discoInterval) return

  clearInterval(discoInterval)
  discoInterval = undefined

  edges.value = edges.value.map(edge => ({
    ...edge,
    animated: true,
    interactionWidth: 20,
    style: {
      strokeWidth: 4
      ,
    },
    markerEnd: { type: 'arrowclosed', color: '#000', width: 6, height: 6 },
  }))
}







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


watch(designMode, (mode) => {
  if (mode === 'disco') {
    startDiscoEdges()
  } else {
    stopDiscoEdges()
  }
})


onUnmounted(() => {
  if (discoInterval) {
    clearInterval(discoInterval)
  }
})



</script>

<template>



  <div style="width: 100%; height: 100vh"   class="app-root" :class="{ 'disco-mode': designMode === 'disco' }">



    <ul v-if="designMode === 'disco'" class="strand">
      <li v-for="i in 100" :key="i"></li>
    </ul>


    <div v-if="designMode === 'disco'" class="disco-reflections">
  <span
      v-for="i in 160"
      :key="i"
      class="reflection"
      :style="{
      '--rx': Math.random() * 100,
      '--ry': Math.random() * 100
    }"
  />
    </div>




    <div
        v-if="edgeMenu.visible"
        class="edge-toolbar"
        :style="{ top: `${edgeMenu.y}px`, left: `${edgeMenu.x}px` }"
    >
      <!-- Löschen geht immer -->
      <button class="delete-btn" @click="deleteEdge">🗑️</button>

      <!-- Insert-Buttons nur, wenn erlaubt -->
      <template v-if="canInsertNodes">
        <button @click="insertNodeOnEdge('edit')">Insert Edit Node</button>
        <button @click="insertNodeOnEdge('paraphrase')">Insert Paraphrase Node</button>
        <button @click="insertNodeOnEdge('grammar')">Insert Grammar Node</button>
      </template>
    </div>

    <div v-if="snapshotInProgress" class="screenshot-overlay"></div>


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
      <template #node-figure="figureProps">
        <FigureNode v-bind="figureProps"/>
      </template>
      <template #node-tourGuide="tourGuideProps">
        <TourGuideNode v-bind="tourGuideProps" />
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



/* Disco Mode */


body{
}
.strand{
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  position: absolute;
  z-index: 1;
  margin: -15px 0 0 0;
  padding: 0;
  pointer-events: none;
  width: 100%;
}
.strand li{
  position: relative;
  -webkit-animation-fill-mode: both;
  animation-fill-mode: both;
  -webkit-animation-iteration-count: infinite;
  animation-iteration-count: infinite;
  list-style: none;
  margin: 0;
  padding: 0;
  display: block;
  width: 12px;
  height: 28px;
  border-radius: 50%;
  margin: 20px;
  display: inline-block;
  background:#f02241;
  box-shadow: 0px 4.66667px 24px 3px #f02241;
  -webkit-animation-name: flash-1;
  animation-name: flash-1;
  -webkit-animation-duration: 2s;
  animation-duration: 2s;
}
.strand li:nth-child(2n+1){
  background: #22ff00;
  box-shadow: 0px 4.66667px 24px 3px rgba(0, 255, 255, 0.5);
  -webkit-animation-name: flash-2;
  animation-name: flash-2;
  -webkit-animation-duration: 0.4s;
  animation-duration: 0.4s;
}
.strand li:nth-child(4n+2){
  background: #dfff33;
  box-shadow: 0px 4.66667px 24px 3px #fd7a35;
  -webkit-animation-name: flash-3;
  animation-name: flash-3;
  -webkit-animation-duration: 1.1s;
  animation-duration: 1.1s;
}
.strand li:nth-child(odd){
  -webkit-animation-duration: 1.8s;
  animation-duration: 1.8s;
}
.strand li:nth-child(3n+1){
  -webkit-animation: 1.4s;
  animation-duration: 1.4s;
}
.strand li:before{
  content: "";
  position: absolute;
  background: #222;
  width: 10px;
  height: 9.33333px;
  border-radius: 3px;
  top: -4.66667px;
  left: 1px;
}
.strand li:after{
  content: "";
  top: -14px;
  left: 9px;
  position: absolute;
  width: 52px;
  height: 18.66667px;
  border-bottom: solid #222 2px;
  border-radius: 50%;
}
.strand li:last-child:after{
  content: none;
}
.strand li:first-child{
  margin-left: 40px;
}
@-webkit-keyframes flash-1{
  0%, 100%{
    background: #f02241;
    box-shadow: 0px 4.66667px 24px 3px #f02241;
  }
  50%{
    background: rgba(240, 34, 65, 0.4);
    box-shadow: 0px 4.66667px 24px 3px rgba(240, 35, 65, .02);
  }
}
@keyframes flash-1{
  0%,
  100% {
    background: #f02241;
    box-shadow: 0px 4.66667px 24px 3px #f02241;
  }
  50% {
    background: rgba(240, 34, 65, 0.4);
    box-shadow: 0px 4.66667px 24px 3px rgba(240, 35, 65, 0.2);
  }
}
@-webkit-keyframes flash-2{
0,
100%{
  background: #42b261;
  box-shadow: 0px 4.66667px 24px 3px #42b261;
}
50%{
  background: rgba(66, 178, 97, 0.4);
  box-shadow: 0px 4.6667px 24px 3px rgba(66, 178, 97, 0.2);
}
}
@keyframes flash-2{
  0%,
  100% {
    background: #42b261;
    box-shadow: 0px 4.66667px 24px 3px #42b261;
  }
  50% {
    background: rgba(66, 178, 97, 0.4);
    box-shadow: 0px 4.66667px 24px 3px rgba(66, 178, 97, 0.2);
  }
}
@-webkit-keyframes flash-3 {
  0%,100%{
    background: #fd7a35;
    box-shadow: 0px 4.6667px 24px 3px #a318e1;
  }
  50%{
    background: rgba(249, 251, 238, .4);
    box-shadow: 0px 4.66667px 24px 3px rgba(249, 251, 238, .2);
  }
}

@keyframes flash-3 {
  0%,100% {
    background: #d700f1;
    box-shadow: 0px 4.66667px 24px 3px #c5ea00;
  }
  50% {
    background: rgba(249, 251, 238, 0.4);
    box-shadow: 0px 4.66667px 24px 3px rgba(249, 251, 238, 0.2);
  }
}

.disco-mode .vue-flow__viewport {
  background-color: rgb(0, 0, 0);
}

.vue-flow__pane,
.vue-flow__viewport {
  transition: background-color 0.4s ease;
}

.disco-mode .vue-flow__minimap {
  box-shadow:
      0 0 20px rgba(255, 0, 255, 0.77),
      0 0 40px rgba(0, 255, 255, 0.84);
}


/* ===============================
   🪩 Discoball Wall Reflections
   =============================== */

.disco-reflections {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 2;
  overflow: hidden;

  /* langsame Gesamtrotation */
  animation: disco-rotate 18s linear infinite;
}

/* Einzelne Lichtpunkte */
.disco-reflections .reflection {
  position: absolute;

  width: 6px;
  height: 6px;
  border-radius: 50%;

  opacity: 0.8;
  background: currentColor;

  box-shadow:
      0 0 6px currentColor,
      0 0 12px currentColor;

  animation:
      disco-flicker 2.5s ease-in-out infinite,
      disco-slide 12s linear infinite;
}

/* Farben wie echte Discokugel */
.disco-reflections .reflection:nth-child(4n) { color: #ffffff; }
.disco-reflections .reflection:nth-child(4n+1) { color: #00ffff; }
.disco-reflections .reflection:nth-child(4n+2) { color: #ff00ff; }
.disco-reflections .reflection:nth-child(4n+3) { color: #ffff66; }

/* Zufällige Startpositionen */
.disco-reflections .reflection {
  top: calc(var(--ry) * 1vh);
  left: calc(var(--rx) * 1vw);
}

/* Leichtes horizontales Wandern */
@keyframes disco-slide {
  0% {
    transform: translateX(-30px);
  }
  50% {
    transform: translateX(30px);
  }
  100% {
    transform: translateX(-30px);
  }
}

/* Funkeln */
@keyframes disco-flicker {
  0%, 100% { opacity: 0.2; }
  50% { opacity: 1; }
}

/* Gesamtdrehung wie Discokugel */
@keyframes disco-rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}






</style>
