<script setup lang="ts">
import { computed, ref, watch, inject, nextTick, provide} from 'vue'
import { Panel, useVueFlow } from '@vue-flow/core'
import Icon from './Icon.vue'
import { nodeTemplates } from './nodes/templates'
import { applyDagreLayout } from './api/layouts.ts'
import type { Ref } from 'vue'
import { useDemo } from './api/demo.ts'
import type {BibEntry, Language} from "@/App.vue";
import {parseLatexToNodesAndEdges} from '@/api/latexParser'
import JSZip from 'jszip'

import FigurePanelContent from "@/Panels/FigurePanelContent.vue";
import ReferencePanelContent from "@/Panels/ReferencePanelContent.vue";
import StylePanelContent from "@/Panels/StylePanelContent.vue";
import SnapshotsPanelContent from "@/Panels/SnapshotsPanelContent.vue";


interface StyleTemplate {
  templateName: string
  tone: string
  sectionLength: number
  emphasizePoints: string
}

interface ZipFileEntry {
  path: string
  type: 'tex' | 'bib' | 'image' | 'other'
  content: string | ArrayBuffer
}

interface Snapshot {
  id: string
  name: string
  createdAt: number
  data: any
  screenshot?: string
}


const demoActive = inject<Ref<boolean>>('demoActive', ref(false))!
const bibliography = inject<Ref<BibEntry[]>>('bibliography')!
const { nodes, edges, setNodes, setEdges, screenToFlowCoordinate, addNodes, dimensions, toObject, fromObject} = useVueFlow()
const availableTemplates = computed(() => nodeTemplates)
const TLDR = inject<Ref<boolean>>('TLDR')!
const imageCache = inject<Ref<Record<string, string>>>('imageCache')
const showIntro = ref(true) //Demo-Mode!!!
const fileInputRef = ref<HTMLInputElement | null>(null)
const activeSidebar = ref<null | '📚 bibliography' | '🖼️ figures' | '✏️ style' | '📸 snapshots'>(null)
const templates = inject<Ref<StyleTemplate[]>>('styleTemplates')!
const setTemplates = inject<(newList: StyleTemplate[]) => void>('setStyleTemplates')!
const language = inject<Ref<'en' | 'de'>>('language')!
const languageLabel = computed(() => language.value.toUpperCase())
const uploadedFiles = ref<ZipFileEntry[]>([])
const selectedMainTex = ref<string | null>(null)
const showLatexFilePicker = ref(false)
const createSnapshot = inject<() => Promise<void>>('createSnapshot')!
const snapshots = inject<Ref<Snapshot[]>>('snapshots')!


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

function toggleLanguage() {
  language.value = language.value === 'en' ? 'de' : 'en'
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

async function onSaveToFile(): Promise<void> {

  const exportData = JSON.parse(JSON.stringify(toObject()))

  exportData.nodes.forEach((node: any) => {
    if (node.data?.imageName && imageCache?.value[node.data.imageName]) {
      node.data.image = imageCache.value[node.data.imageName]
    }
  })

  exportData.bibliography = bibliography.value
  exportData.TLDR = TLDR.value
  exportData.templates = templates.value

  // Snapshots komplett einfügen
  exportData.snapshots = snapshots.value.map(snap => ({
    id: snap.id,
    name: snap.name,
    createdAt: snap.createdAt,
    data: snap.data,
    screenshot: snap.screenshot
  }))

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

      setNodes([])
      setEdges([])

      await nextTick()

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

      if (data.templates && setTemplates) {
        setTemplates(data.templates)
      }

      // Snapshots wiederherstellen
      if (data.snapshots) {
        snapshots.value = data.snapshots
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

function UploadFile() {
  showIntro.value = false
}

async function onLatexZipUpload(file: File) {
  if (!file || !file.name.endsWith('.zip')) return

  const reader = new FileReader()

  reader.onload = async () => {
    const arrayBuffer = reader.result as ArrayBuffer
    const zip = await JSZip.loadAsync(arrayBuffer)

    const files: ZipFileEntry[] = []

    async function processZip(zip: JSZip) {
      for (const entry of Object.values(zip.files)) {
        if (entry.dir) continue

        if (entry.name.endsWith('.tex')) {
          files.push({
            path: entry.name,
            type: 'tex',
            content: await entry.async('string')
          })
        } else if (entry.name.endsWith('.bib')) {
          files.push({
            path: entry.name,
            type: 'bib',
            content: await entry.async('string')
          })
        } else if (/\.(png|jpe?g|gif|svg|pdf)$/i.test(entry.name)) {
          const base64 = await entry.async('base64')
          const ext = entry.name.split('.').pop() || 'png'
          files.push({
            path: entry.name,
            type: 'image',
            content: `data:image/${ext};base64,${base64}`
          })
        } else {
          files.push({
            path: entry.name,
            type: 'other',
            content: await entry.async('string')
          })
        }
      }
    }

    await processZip(zip)

    // ✅ HIER der entscheidende Schritt
    uploadedFiles.value = files
    selectedMainTex.value = null
    showLatexFilePicker.value = true
    showIntro.value = false
  }

  reader.readAsArrayBuffer(file)
}


function importLatexProject() {
  if (!selectedMainTex.value) return

  const mainFile = uploadedFiles.value.find(
      f => f.path === selectedMainTex.value
  )

  if (!mainFile || typeof mainFile.content !== 'string') return

  const { nodes: parsedNodes, edges: parsedEdges } =
      parseLatexToNodesAndEdges(
          uploadedFiles.value,
          selectedMainTex.value,
          (newBib) => {
            const unique = newBib.filter(
                e => !bibliography.value.some(b => b.id === e.id)
            )
            bibliography.value.push(...unique)
          }
      )

  parsedNodes.forEach((node, i) => {
    node.position = { x: 50, y: i * 50 }
  })

  setNodes(parsedNodes)
  setEdges(parsedEdges)

  showLatexFilePicker.value = false
}


function togglePanel(panel: '📚 bibliography' | '🖼️ figures' |'✏️ style' | '📸 snapshots') {
  if (activeSidebar.value === panel) {
    activeSidebar.value = null // Schaltet aus, wenn nochmal geklickt
  } else {
    activeSidebar.value = panel
  }
}

</script>


<template>

  <!-- Demo Overlay -->
  <div v-if="showIntro" class="demo-overlay">
    <div class="demo-box">
      <h1>👋 Hey there! Looks like you're new here.</h1>
      <p>What would you like to do?</p>
      <div class="demo-buttons">
        <label class="skip-button upload-label" @click="handleSkipDemo">Start Empty Project</label>

        <label class="skip-button upload-label" @change="onRestoreFromFile" @click="UploadFile">
          Upload Project from File
          <input type="file" accept=".json"/>
        </label>

        <label class="skip-button upload-label">
          Upload LaTeX-File (.zip)
          <input
              type="file"
              accept=".zip"
              ref="fileInputRef"
              @change="(e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) onLatexZipUpload(file);
    }"
          />
        </label>

        <label class="start-button upload-label" @click="handleStartDemo" >🎬 Start Tour</label>
      </div>
    </div>
  </div>

  <!-- Latex Filepicker -->

  <div v-if="showLatexFilePicker" class="latex-overlay">
    <div class="latex-box">
      <h1>📄 Select main LaTeX file</h1>
      <p>Please choose the entry point of your project to begin with the import.</p>

      <ul class="latex-file-list">
        <li v-for="file in uploadedFiles" :key="file.path">
          <label v-if="file.type === 'tex'" class="latex-file">
            <input
                type="radio"
                name="mainTex"
                :value="file.path"
                v-model="selectedMainTex"
            />
            📄 {{ file.path }}
          </label>

          <span v-else class="latex-file muted">
          {{ file.type === 'image' ? '🖼' : '📦' }} {{ file.path }}
        </span>
        </li>
      </ul>

      <button
          class="start-button"
          :disabled="!selectedMainTex"
          @click="importLatexProject"
      >
        🚀 Import project
      </button>
    </div>
  </div>


  <!-- BOTTOM DEMO CONTROLS -->
  <div v-if="demoActive" class="demo-controls">
    <button class="next-step-btn" @click="nextStep">➡️ Next Step</button>
    <button class="end-demo-btn" @click="skipDemo">🛑 End Demo</button>
  </div>

  <!-- Main Control Interface (Left Side) -->

  <Panel position="top-left">
    <div class="panel-content">
         <label class="sr-only" for="node-type-select">Node type</label>
         <div class="buttons">

           <button title="Snapshot (Save your progress. Restore using the Snapshots-Panel)" @click="createSnapshot">
             📸
           </button>
          <button title="Download (Save project to file)" @click="onSaveToFile">
            💾
          </button>
          <button title="Upload (Load project from file)" class="upload-label">
            📂
            <input type="file" accept=".json" @change="onRestoreFromFile" />
          </button>
         </div>
      <div class="buttons">

        <button
            title="Delete (Delete all selected nodes or edges. Currently selected nodes appear red in the minimap. Select multiple elements by holding CTRL.)"
            @click="onDeleteSelected">
          🗑️
        </button>
        <button title="Unchaosify (This will automatically sort your elements according to the flow of the content)" @click="onAutoLayout" >
          🔮
        </button>
      </div>

      <div class="toggle-switches">
        <div class="toggle-switch" v-for="panel in ['📚 bibliography','🖼️ figures','✏️ style', '📸 snapshots']" :key="panel">
          <label>
            <input type="checkbox"
                   :checked="activeSidebar === panel"
                   @change="() => togglePanel(panel as '📚 bibliography' | '🖼️ figures' | '✏️ style' | '📸 snapshots')" />
            <span class="slider purple"></span>
          </label>
          <span class="toggle-label">
            {{ panel.charAt(0).toUpperCase() + panel.slice(1) }}
          </span>
        </div>
      </div>

      <div class="toggle-switch-group">
      <div class="toggle-switch">
        <label>
          <input type="checkbox" v-model="TLDR" />
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
              type="checkbox"
              :checked="language === 'de'"
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
            class="draggable-node utility-node"
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
            class="draggable-node llm-node"
            draggable="true"
            @dragstart="onDragStart(template.type, $event)"
            title="Drag and drop nodes you would like to add over to the canvas"
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
      <ReferencePanelContent />
    </div>
  </Panel>

  <Panel v-if="activeSidebar === '🖼️ figures'" position="top-right">
    <div class="side-panel">
      <h4>Figure Tracker</h4>
      <FigurePanelContent />
    </div>
  </Panel>

  <Panel v-if="activeSidebar === '✏️ style'" position="top-right">
    <div class="side-panel">
      <h4>Style Specifications</h4>
      <StylePanelContent />
    </div>
  </Panel>

  <Panel v-if="activeSidebar === '📸 snapshots'" position="top-right">
    <div class="side-panel">
      <h4>Snapshots</h4>
      <SnapshotsPanelContent />
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
  align-items: center;
}

.draggable-node {
  padding: 6px 8px;
  background: #f7f7f7;
  border: 1px solid rgba(15,23,42,.15);
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
  border: 2px solid #fd7a35;
  font-weight: 600;
}

.utility-node:hover {
  box-shadow: 0 0 8px rgba(253, 122, 53, 0.6);
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
  font-size: 1.0rem;
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


.latex-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 15, 15, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000; /* WICHTIG: höher als VueFlow & Panels */
  backdrop-filter: blur(6px);
  animation: fadeIn 0.4s ease forwards;
}

.latex-box {
  background: rgba(30, 30, 30, 0.95);
  color: white;
  padding: 2rem 3rem;
  border-radius: 20px;
  max-width: 700px;
  width: 100%;
  box-shadow: 0 0 40px rgba(255, 255, 255, 0.1);
  text-align: center;
  position: relative;
  overflow: hidden;
}

.latex-box::before {
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

.latex-box h1 {
  font-size: 1.6rem;
  margin-bottom: 0.5rem;
}

.latex-box p {
  opacity: 0.8;
  margin-bottom: 1.5rem;
}

.latex-file-list {
  list-style: none;
  padding: 0;
  margin: 1rem 0 1.5rem;
  max-height: 300px;
  overflow-y: auto;
  text-align: left;
}

.latex-file {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.4rem 0.6rem;
  border-radius: 8px;
  cursor: pointer;
}

.latex-file:hover {
  background: rgba(255, 255, 255, 0.08);
}

.latex-file input {
  accent-color: #00ff88;
}

.latex-file.muted {
  opacity: 0.4;
  padding-left: 1.8rem;
  pointer-events: none;
}

.latex-box .start-button {
  margin-top: 1rem;
}

.latex-box button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

</style>