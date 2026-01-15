<script lang="ts" setup>
import {computed, ref, watch, inject, nextTick, provide, type Ref} from 'vue'
import {Panel, useVueFlow} from '@vue-flow/core'
import {nodeTemplates} from './nodes/templates'
import {onMounted, onUnmounted} from 'vue'


import {useLoadAndSave} from './api/LoadAndSave.ts'
import {applyDagreLayout} from './api/layouts.ts'
import {useDemo} from './api/demo.ts'
import {useSnapshots} from '@/api/Snapshots'


import FigurePanelContent from "@/Panels/FigurePanelContent.vue";
import ReferencePanelContent from "@/Panels/ReferencePanelContent.vue";
import StylePanelContent from "@/Panels/StylePanelContent.vue";
import SnapshotsPanelContent from "@/Panels/SnapshotsPanelContent.vue";
import StartupPanelContent from "@/Panels/StartupPanelContent.vue";
import LlmQueuePanelContent from "@/Panels/LlmQueuePanelContent.vue";
import {llmBusy} from "@/api/llmQueue.ts";


const demoActive = inject<Ref<boolean>>('demoActive', ref(false))!
const availableTemplates = computed(() => nodeTemplates)
const TLDR = inject<Ref<boolean>>('TLDR')!
const activeSidebar = ref<null | '📚 bibliography' | '🖼️ figures' | '✏️ style' | '📸 snapshots'>(null)
const language = inject<Ref<'en' | 'de'>>('language')!
const languageLabel = computed(() => language.value.toUpperCase())


const {
  createSnapshot,
  restoreSnapshot,
  deleteSnapshot,
  createAutosaveSnapshot,
} = useSnapshots()


const {
  nodes,
  edges,
  setNodes,
  setEdges,
  screenToFlowCoordinate,
  addNodes,
  dimensions,
  toObject,
  fromObject
} = useVueFlow()

const {startDemo, skipDemo, nextStep} = useDemo({
  demoActive,
  nodes,
  setNodes,
  setEdges,
  addNodes,
  screenToFlowCoordinate,
  dimensions
})

const {saveToFile, restoreFromFile} = useLoadAndSave()




function onDragStart(type: string, event: DragEvent) {
  if (!event.dataTransfer) return
  event.dataTransfer.setData('node/type', type)
  event.dataTransfer.effectAllowed = 'move'
}

function onDeleteSelected() {
  const remainingEdges = edges.value.filter(edge => !edge.selected)
  setEdges(remainingEdges)
  const remainingNodes = nodes.value.filter(node => !node.selected)
  setNodes(remainingNodes)
}

function onAutoLayout() {
  const newNodes = applyDagreLayout(nodes.value, edges.value, 'LR')
  setNodes(newNodes)
}

function toggleLanguage() {
  language.value = language.value === 'en' ? 'de' : 'en'
}

function togglePanel(panel: '📚 bibliography' | '🖼️ figures' | '✏️ style' | '📸 snapshots') {
  if (activeSidebar.value === panel) {
    activeSidebar.value = null // Schaltet aus, wenn nochmal geklickt
  } else {
    activeSidebar.value = panel
  }
}




let autosaveInterval: number | undefined

onMounted(() => {
  autosaveInterval = window.setInterval(() => {
    createAutosaveSnapshot()
  }, 60_000) // 60 Sekunden
})

onUnmounted(() => {
  if (autosaveInterval) {
    clearInterval(autosaveInterval)
  }
})


</script>


<template>


  <StartupPanelContent />

  <Panel
      v-if="llmBusy"
      position="bottom-center"
      class="llm-queue-panel"
  >
    <LlmQueuePanelContent />
  </Panel>

  <!-- Main Control Interface (Left Side) -->

  <Panel position="top-left">
    <div class="panel-content">
      <label class="sr-only" for="node-type-select">Node type</label>

      <!-- First Button Row -->

        <div class="buttons">
          <button title="Snapshot (Save your progress. Restore using the Snapshots-Panel)" @click="createSnapshot">
          📸
          </button>
          <button title="Download (Save project to file)" @click="saveToFile">
            💾
          </button>
          <button class="upload-label" title="Upload (Load project from file)">
            📂
            <input accept=".json" type="file" @change="restoreFromFile"/>
          </button>
      </div>

      <!-- Second Button Row -->

      <div class="buttons">
        <button
            title="Delete (Delete all selected nodes or edges. Currently selected nodes appear red in the minimap. Select multiple elements by holding CTRL.)"
            @click="onDeleteSelected">
            🗑️
        </button>
        <button title="Unchaosify (This will automatically sort your elements according to the flow of the content)"
                @click="onAutoLayout">
            🔮
        </button>
      </div>

      <!-- Floating Panel Switches -->

      <div class="toggle-switches">
        <div v-for="panel in ['📚 bibliography','🖼️ figures','✏️ style', '📸 snapshots']" :key="panel"
             class="toggle-switch">
          <label>
            <input :checked="activeSidebar === panel"
                   type="checkbox"
                   @change="() => togglePanel(panel as '📚 bibliography' | '🖼️ figures' | '✏️ style' | '📸 snapshots')"/>
            <span class="slider purple"></span>
          </label>
          <span class="toggle-label">
            {{ panel.charAt(0).toUpperCase() + panel.slice(1) }}
          </span>
        </div>
      </div>

      <!-- Other Switches -->

      <div class="toggle-switch-group">
        <div class="toggle-switch">
          <label>
            <input v-model="TLDR" type="checkbox"/>
            <span class="slider"></span>
          </label>
          <span
              class="toggle-label"
              title="Enable or disable TLDR mode for all Text Input Nodes and Figure Nodes for a better overview.">
              TLDR-Mode
          </span>
        </div>
        <div class="toggle-switch">
          <label>
            <input
                :checked="language === 'de'"
                type="checkbox"
                @change="toggleLanguage"
            />
            <span class="slider flag"></span>
          </label>
          <span
              class="toggle-label"
              title="Switch LLM-prompts between English and German">
              Language: {{ languageLabel }}
        </span>
        </div>
      </div>

      <!-- Draggable Nodes -->

      <div class="drag-nodes">
        <!-- Content Nodes -->
        <h4
            class="drag-category"
        >
          Content Nodes
        </h4>
        <div
            v-for="template in availableTemplates.filter(t => t.category === 'text')"
            :key="template.type"
            class="draggable-node content-node"
            draggable="true"
            title="Drag and drop nodes you would like to add over to the canvas"
            @dragstart="onDragStart(template.type, $event)"
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
            class="draggable-node utility-node"
            draggable="true"
            title="Drag and drop nodes you would like to add over to the canvas"
            @dragstart="onDragStart(template.type, $event)"
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
            class="draggable-node llm-node"
            draggable="true"
            title="Drag and drop nodes you would like to add over to the canvas"
            @dragstart="onDragStart(template.type, $event)"
        >
          {{ template.label }}
        </div>
      </div>
    </div>
  </Panel>


  <!-- Floating Control Panels (Right Side) -->

  <Panel v-if="activeSidebar === '📚 bibliography'" position="top-right">
    <div class="side-panel">
      <h4>Reference Tracker</h4>
      <ReferencePanelContent/>
    </div>
  </Panel>

  <Panel v-if="activeSidebar === '🖼️ figures'" position="top-right">
    <div class="side-panel">
      <h4>Figure Tracker</h4>
      <FigurePanelContent/>
    </div>
  </Panel>

  <Panel v-if="activeSidebar === '✏️ style'" position="top-right">
    <div class="side-panel">
      <h4>Style Specifications</h4>
      <StylePanelContent/>
    </div>
  </Panel>

  <Panel v-if="activeSidebar === '📸 snapshots'" position="top-right">
    <div class="side-panel">
      <h4>Snapshots</h4>
      <SnapshotsPanelContent/>
    </div>
  </Panel>


</template>


<style scoped>
.panel-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.buttons {
  display: grid;
  grid-template-columns: repeat(3, 36px);
  grid-auto-rows: 36px;
  gap: 0.5rem;
  justify-content: center;
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



.drag-nodes {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px 0;
  margin-top: 8px;
  align-items: center;
}

.draggable-node {
  padding: 6px 8px;
  background: #f7f7f7;
  border: 1px solid rgba(15, 23, 42, .15);
  border-radius: 4px;
  cursor: grab;
  user-select: none;
  font-size: 0.85rem;
  width: 130px; /* optional: feste Breite für eine "Spalte" */
  text-align: center; /* optional: Text zentrieren */
  transition: background 0.15s, color 0.15s;
}

.draggable-node:hover {
  background: #e5e7eb;
  box-shadow: 0 2px 4px rgba(29, 31, 33, 0.12);
}

/* LLM-based Nodes */
.llm-node {
  border: 2px solid #38bdf8;
  font-weight: 600;
}

.llm-node:hover {
  box-shadow: 0 0 8px rgba(56, 189, 248, 0.6);
}

/* Utility Nodes */
.utility-node {
  border: 2px solid #df6a2d;
  font-weight: 600;
}

.utility-node:hover {
  box-shadow: 0 0 8px rgba(223, 106, 45, 0.6);
}

/* Content  Nodes */
.content-node {
  border: 2px solid #37b329;
  font-weight: 600;
}

.content-node:hover {
  box-shadow: 0 0 8px rgba(55, 179, 41, 0.6);
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


.toggle-switch .toggle-label {
  font-size: 0.85rem;
  color: #ffffff;
}


/* New Sidebar and Switches */

.toggle-switch .slider.purple {
  /*background-color: #9b59b6;*/
}

.toggle-switch input:checked + .slider.purple {
  /*background-color: #8e44ad;*/
}

.toggle-switch input:checked + .slider.purple::before {
  transform: translateX(16px);
}

.toggle-switch input:checked + .slider:not(.flag):not(.purple)::before {
  transform: translateX(16px);
}


.side-panel {
  width: 500px;
  height: 600px;
  max-height: 90vh;
  overflow-y: auto;
  padding: 1rem;
  border-radius: 12px;
  color: white;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
}

/* Nur TLDR-Slider (ohne zusätzliche Klassen) wird grün */
.toggle-switch input:checked + .slider:not(.flag):not(.purple) {
  background-color: #22ff00;
}

/* Alle anderen speziellen Slider behalten ihr Styling */
.toggle-switch input:checked + .slider.purple {
  background-color: #8e44ad;
}

.toggle-switch .slider.flag {
  background-color: #ccc; /* neutraler Hintergrund */
}

.toggle-switch .slider.flag::before {
  content: "";
  position: absolute;
  height: 16px;
  width: 16px;
  left: 2px;
  bottom: 2px;
  border-radius: 50%;
  background-size: cover;
  transition: 0.2s;
}

/* Wenn unchecked, englische Flagge */
.toggle-switch input:not(:checked) + .slider.flag::before {
  background-image: url('https://upload.wikimedia.org/wikipedia/en/a/ae/Flag_of_the_United_Kingdom.svg');
}

/* Wenn checked, deutsche Flagge */
.toggle-switch input:checked + .slider.flag::before {
  background-image: url('https://upload.wikimedia.org/wikipedia/en/b/ba/Flag_of_Germany.svg');
  transform: translateX(16px);
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

</style>