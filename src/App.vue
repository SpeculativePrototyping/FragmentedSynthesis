<script setup lang="ts">
import { ref, watch } from 'vue'
import {type Node, type Edge, type Connection, useVueFlow} from '@vue-flow/core'
import { VueFlow, addEdge } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import SaveRestoreControls from './Controls.vue'
import { findNodeTemplate} from './nodes/templates'
import {MiniMap} from "@vue-flow/minimap";

//Import every node-component:
import ConcatNode from './components/ConcatNode.vue'
import TextAreaNode from './components/TextAreaNode.vue'
import TextViewNode from './components/TextViewNode.vue'
import SummaryNode from './components/SummaryNode.vue'
import ComposeNode from './components/ComposeNode.vue'
import DocOutputNode from './components/DocOutputNode.vue'
import EditNode from './components/EditNode.vue'
import GrammarNode from './components/GrammarNode.vue'
import StickyNote from "@/components/StickyNote.vue";
import ReferenceTrackerNode from "@/components/ReferenceTrackerNode.vue";

export interface BibEntry {
  id: string
  type: string
  fields: Record<string, string>
  raw?: string   // <-- der rohe BibTeX-Block
}

//reactive lists of the nodes and edges
const nodes = ref<Node[]>([])
const edges = ref<Edge[]>([])
const bibliography = ref<BibEntry[]>([])  // <- global bibliography

const {addNodes, screenToFlowCoordinate} = useVueFlow()
let nodeCounter = 0

const updateBibliography = (newBib: BibEntry[]) => {
  bibliography.value = newBib
}


function onConnect(connection: Connection) {
  edges.value = addEdge(connection, edges.value) as Edge[]
}

//animated edges with arrows and flow-direction
watch(edges, (newEdges) => {
  newEdges.forEach(edge => {
    if (edge.animated === undefined) edge.animated = true
    if (!edge.style) edge.style = {}
    if (!edge.markerEnd) edge.markerEnd = { type: 'arrowclosed', color: '#000000' }
    else {
    }
  })
}, { deep: true, immediate: true })

//function to take over chosen type from controls.vue and drop node on the canvas
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

</script>

<template>
  <div style="width: 100%; height: 100vh">
    <VueFlow
        v-model:nodes="nodes"
        v-model:edges="edges"
        @connect="onConnect"
        @drop ="onDrop"
        @dragover.prevent
    >
      <SaveRestoreControls />

      <template #node-concat="concatNodeProps">
        <ConcatNode v-bind="concatNodeProps" />
      </template>
      <template #node-textArea="textAreaProps">
        <TextAreaNode
            v-bind="textAreaProps"
            :bibliography="bibliography"
            :updateBibliography="updateBibliography"
        />
      </template>
      <template #node-textView="textViewProps">
        <TextViewNode v-bind="textViewProps" />
      </template>
      <template #node-summary="summaryProps">
        <SummaryNode v-bind="summaryProps" />
      </template>
      <template #node-compose="composeProps">
        <ComposeNode v-bind="composeProps" />
      </template>
      <template #node-docOutput="docOutputProps">
        <DocOutputNode
            v-bind="docOutputProps"
            :bibliography="bibliography"
        />
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
      <template #node-referenceTracker="{ id, data, ...rest }">
        <ReferenceTrackerNode
            :label="data?.label"
            :bibliography="bibliography"
            :updateBibliography="updateBibliography"
            v-bind="rest"
        />
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

</style>
