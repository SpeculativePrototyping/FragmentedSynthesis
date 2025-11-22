<script setup lang="ts">
import { computed, ref, watch, inject, nextTick} from 'vue'
import { Panel, useVueFlow } from '@vue-flow/core'
import Icon from './Icon.vue'
import { nodeTemplates } from './nodes/templates'
import { applyDagreLayout } from './nodes/layouts'
import type { Ref } from 'vue'
import { useDemo } from './demo'
import type {BibEntry} from "@/App.vue";


const demoActive = inject<Ref<boolean>>('demoActive', ref(false))!
const bibliography = inject<Ref<BibEntry[]>>('bibliography')!
const { nodes, edges, setNodes, setEdges, screenToFlowCoordinate, addNodes, dimensions, toObject, fromObject} = useVueFlow()
const availableTemplates = computed(() => nodeTemplates)
const TLDR = inject<Ref<boolean>>('TLDR')!
const imageCache = inject<Ref<Record<string, string>>>('imageCache')
const showIntro = ref(true) //Demo-Mode!!!

const { startDemo, skipDemo, nextStep } = useDemo({
  demoActive,
  nodes,
  setNodes,
  setEdges,
  addNodes,
  screenToFlowCoordinate,
  dimensions
})


function onDragStart(type: string, event: DragEvent) {
  if (!event.dataTransfer) return
  event.dataTransfer.setData('node/type', type)
  event.dataTransfer.effectAllowed = 'move'
}

function onAutoLayout() {
  const newNodes = applyDagreLayout(nodes.value, edges.value, 'LR')
  setNodes(newNodes)
}

function onDeleteSelected() {
  const remainingEdges = edges.value.filter(edge => !edge.selected)
  setEdges(remainingEdges)
  const remainingNodes = nodes.value.filter(node => !node.selected)
  setNodes(remainingNodes)
}

function onSaveToFile(): void {

  const exportData = JSON.parse(JSON.stringify(toObject()))
  exportData.nodes.forEach((node: any) => {
    if (node.data?.imageName && imageCache?.value[node.data.imageName]) {
      node.data.image = imageCache.value[node.data.imageName]
    }
  })

  exportData.bibliography = bibliography.value
  exportData.TLDR = TLDR.value

  const dataStr = JSON.stringify(exportData, null, 2)
  const blob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'graph.json'
  a.click()
  URL.revokeObjectURL(url)
}


function onRestoreFromFile(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = async () => {
    try {
      const data = JSON.parse(reader.result as string)

      data.nodes.forEach((node: any) => {
        if (node.data?.image && node.data.imageName && imageCache) {
          imageCache.value[node.data.imageName] = node.data.image
          node.data.image = undefined
        }
      })

      if (data.bibliography) {
        bibliography.value = data.bibliography
      }

      fromObject(data)

      await nextTick()
      if (typeof data.TLDR === 'boolean') {
        TLDR.value = data.TLDR
      }

    } catch (err) {
      console.error('read error', err)
    }

  }
  reader.readAsText(file)
}

function handleStartDemo() {
  showIntro.value = false
  startDemo()
}

function handleSkipDemo() {
  showIntro.value = false
  skipDemo()
}

</script>

//HTML

<template>

  <!-- Overlay -->
  <div v-if="showIntro" class="demo-overlay">
    <div class="demo-box">
      <h1>👋 Hey there! Looks like you're new here.</h1>
      <p>What would you like to do?</p>
      <div class="demo-buttons">
        <button class="skip-button" @click="handleSkipDemo">Start New Project</button>
        <button class="skip-button">Upload Project from File</button>
        <button class="skip-button">Upload LaTex-File</button>
        <button class="start-button" @click="handleStartDemo">🎬 Start Tour</button>
      </div>
    </div>
  </div>

  <!-- BOTTOM DEMO CONTROLS -->
  <div v-if="demoActive" class="demo-controls">
    <button class="next-step-btn" @click="nextStep">➡️ Next Step</button>
    <button class="end-demo-btn" @click="skipDemo">🛑 End Demo</button>
  </div>

  <Panel position="top-left">
    <div class="panel-content">
         <label class="sr-only" for="node-type-select">Node type</label>
         <div class="buttons">
           <button
               title="Delete selected nodes or edges. Currently selected nodes appear red in the minimap. Select multiple elements by holding CTRL."
               @click="onDeleteSelected">
             <Icon name="trash" />
           </button>
          <button title="Save graph to file" @click="onSaveToFile">
            <Icon name="save" />
          </button>
          <button title="Load graph from file" class="upload-label">
            <Icon name="upload" />
            <input type="file" accept=".json" @change="onRestoreFromFile" />
          </button>
           <button title="Unchaosify - This will automatically sort your elements according to the flow of the content." @click="onAutoLayout" >
             <Icon name="wand" />
           </button>
         </div>
      <div class="drag-nodes">
        <!-- Toggle-Switch für LLM Nodes -->
        <div class="toggle-switch">
          <label>
            <input type="checkbox" />
            <span class="slider"></span>
          </label>
          <span
              class="toggle-label"
              title="Enables the use of LLM-base nodes. Disabling this mode will not remove already implemented nodes.">
            Unethical
          </span>
        </div>
        <div class="toggle-switch">
          <label>
            <input type="checkbox" v-model="TLDR" />
            <span class="slider"></span>
          </label>
          <span
              class="toggle-label"
              title="Enables or disables TLDR mode for all nodes">
    TLDR
  </span>
        </div>

        <!-- Text Nodes -->
        <h4
            class="drag-category"
        >
          Content Nodes
        </h4>
        <div
            v-for="template in availableTemplates.filter(t => t.category === 'text')"
            :key="template.type"
            class="draggable-node"
            draggable="true"
            @dragstart="onDragStart(template.type, $event)"
            title="Drag and drop nodes you would like to add over to the canvas"
        >
          {{ template.label }}
        </div>
        <!-- Utility Nodes -->
        <h4
            class="drag-category"
        >
          Utility Nodes
        </h4>
        <div
            v-for="template in availableTemplates.filter(t => t.category === 'utility')"
            :key="template.type"
            class="draggable-node"
            draggable="true"
            @dragstart="onDragStart(template.type, $event)"
            title="Drag and drop nodes you would like to add over to the canvas"
        >
          {{ template.label }}
        </div>
        <!-- LLM Nodes -->
        <h4
            class="drag-category"
        >
          LLM-based Nodes
        </h4>
        <div
            v-for="template in availableTemplates.filter(t => t.category === 'llm')"
            :key="template.type"
            class="draggable-node"
            draggable="true"
            @dragstart="onDragStart(template.type, $event)"
            title="Drag and drop nodes you would like to add over to the canvas"
        >
          {{ template.label }}
        </div>
      </div>
    </div>
   </Panel>
</template>

//CSS

<style scoped>
.panel-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.buttons {
  display: flex;

  flex-direction: column;
  gap: 0.5rem;
}

.buttons button {
  align-items: center;
  background-color: white;
  color: black;
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 6px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
  cursor: pointer;
  display: inline-flex;
  height: 36px;
  justify-content: center;
  padding: 0.25rem;
  transition: background-color 0.2s ease, box-shadow 0.2s ease;
}

.buttons button:hover {
  background-color: rgba(95, 95, 95, 0.08);
  box-shadow: 0 2px 4px rgba(29, 31, 33, 0.12);
}

.buttons svg,
.add-button svg {
  height: 18px;
  width: 18px;
}

.sr-only {
  border: 0;
  clip: rect(0 0 0 0);
  height: 1px;
  margin: -1px;
  overflow: hidden;
  padding: 0;
  position: absolute;
  width: 1px;
}

.upload-label {
  position: relative;
  align-items: center;
  background-color: white;
  color: black;
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 6px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
  cursor: pointer;
  display: inline-flex;
  height: 36px;
  justify-content: center;
  padding: 0.25rem;
  transition: background-color 0.2s ease, box-shadow 0.2s ease;
}

.upload-label:hover {
  background-color: rgba(95, 95, 95, 0.08);
  box-shadow: 0 2px 4px rgba(29, 31, 33, 0.12);
}

.upload-label input {
  position: absolute;
  left: 0;
  top: 0;
  opacity: 0;
  width: 100%;
  height: 100%;
  pointer-events: all;
}

.drag-nodes {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px 0;
  margin-top: 8px;
}

.draggable-node {
  padding: 6px 8px;
  background-color: #eee;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: grab;
  user-select: none;
  font-size: 0.85rem;
  width: 120px; /* optional: feste Breite für eine "Spalte" */
  text-align: center; /* optional: Text zentrieren */
}

.drag-category {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgb(255, 255, 255);
  margin-top: 10px;
  margin-bottom: 4px;
  padding-left: 2px;
  border-bottom: 1px solid rgb(255, 255, 255);
}

/* Animated Toggle-Switch experimental */
.toggle-switch {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.toggle-switch label {
  position: relative;
  display: inline-block;
  width: 36px;
  height: 20px;
}

.toggle-switch label input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-switch .slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  border-radius: 12px;
  transition: 0.2s;
}

.toggle-switch .slider::before {
  position: absolute;
  content: "";
  height: 16px;
  width: 16px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  border-radius: 50%;
  transition: 0.2s;
}

.toggle-switch input:checked + .slider {
  background-color: #22ff00;
}

.toggle-switch input:checked + .slider::before {
  transform: translateX(16px);
}

.toggle-switch .toggle-label {
  font-size: 0.85rem;
  color: #ffffff;
}

/* Rainbow-vomit demo mode */

.demo-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 15, 15, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(6px);
  animation: fadeIn 0.6s ease forwards;
}

.demo-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(15, 15, 15, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(6px);
  animation: fadeIn 0.6s ease forwards;
}

.demo-box {
  background: rgba(30, 30, 30, 0.95);
  color: white;
  padding: 2rem 3rem;
  border-radius: 20px;
  text-align: center;
  max-width: 600px;
  box-shadow: 0 0 40px rgba(255, 255, 255, 0.1);
  border: 2px solid transparent;
  background-clip: padding-box;
  position: relative;
  overflow: hidden;
}

.demo-box::before {
  pointer-events: none;
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 20px;
  padding: 2px;
  background: linear-gradient(
      90deg,
      red,
      orange,
      yellow,
      lime,
      cyan,
      blue,
      magenta,
      red
  );
  background-size: 400%;
  animation: rainbowBorder 3s linear infinite;
  -webkit-mask:
      linear-gradient(#fff 0 0) content-box,
      linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
}

.demo-box h1 {
  font-size: 1.8rem;
  margin-bottom: 1rem;
}

.demo-box p {
  font-size: 1rem;
  margin-bottom: 0.75rem;
  line-height: 1.4;
}

.demo-buttons {
  margin-top: 1.5rem;
  display: flex;
  justify-content: center;
  gap: 1.5rem;
}

.start-button,
.skip-button {
  padding: 0.75rem 1.5rem;
  font-size: 1.1rem;
  font-weight: 600;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.25s ease;
}

.start-button {
  background: linear-gradient(90deg, #00ff88, #0088ff);
  color: black;
}

.start-button:hover {
  transform: scale(1.05);
  box-shadow: 0 0 20px rgba(0, 255, 136, 0.4);
}

.skip-button {
  background: #444;
  color: white;
}

.skip-button:hover {
  transform: scale(1.05);
  background: #666;
}

@keyframes rainbowBorder {
  0% {
    background-position: 0% 50%;
  }
  100% {
    background-position: 400% 50%;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* BOTTOM DEMO CONTROL BAR */
.demo-controls {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 1rem;
  background: rgba(25, 25, 25, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 0.75rem 1.5rem;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  z-index: 9999;
  backdrop-filter: blur(8px);
}

.demo-controls button {
  background: #00bfff;
  border: none;
  border-radius: 8px;
  padding: 0.6rem 1rem;
  color: white;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.demo-controls button:hover {
  background: #1ec8ff;
  transform: translateY(-2px);
}

.demo-controls .end-demo-btn {
  background: #ff4b4b;
}

.demo-controls .end-demo-btn:hover {
  background: #ff6666;
}


</style>
