<script setup lang="ts">
import {computed, ref, watch, inject, nextTick, provide, type Ref} from 'vue'
import JSZip from 'jszip'
import { parseLatexToNodesAndEdges } from '@/api/NewLatexParser.ts'
import {useDemo} from "@/api/demo.ts";
import type {BibEntry} from "@/App.vue";
import {type Edge, Panel, useVueFlow} from '@vue-flow/core'
import type {ZipFileEntry} from "@/App.vue";
import {useLoadAndSave} from "@/api/LoadAndSave.ts";



// global variables
const demoActive = inject<Ref<boolean>>('demoActive')!
const bibliography = inject<Ref<BibEntry[]>>('bibliography')!

const emit = defineEmits<{
  (e: 'import-latex', payload: { nodes: Node[], edges: Edge[] }): void
}>()

// local ui state
const showIntro = ref(true)
const showLatexFilePicker = ref(false)

//file upload variables

const uploadedFiles = ref<any[]>([])
const selectedMainTex = ref<string | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

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


console.log('nodes before import', nodes.value.length)

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

  const {nodes: parsedNodes, edges: parsedEdges} =
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
    node.position = {x: 50, y: i * 50}
  })

  setNodes(parsedNodes)
  console.log('nodes after import', nodes.value.length)
  setEdges(parsedEdges)

  showLatexFilePicker.value = false
}


function handleStartDemo() {
  showIntro.value = false
  startDemo()
}

function handleSkipDemo() {
  showIntro.value = false
  skipDemo()
}

function handleUploadFile() {
  showIntro.value = false
}


</script>

<template>

  <!-- Startup Overlay -->

  <div v-if="showIntro" class="demo-overlay">
    <div class="demo-box">
      <h1>👋 Hey there! Looks like you're new here.</h1>
      <p>What would you like to do?</p>
      <div class="demo-buttons">
        <label class="skip-button upload-label" @click="handleSkipDemo">Start Empty Project</label>
        <label class="skip-button upload-label" @change="restoreFromFile" @click="handleUploadFile">
          Upload Project from File
          <input accept=".json" type="file"/>
        </label>

        <label class="skip-button upload-label">
          Upload LaTeX-File (.zip)
          <input
              ref="fileInputRef"
              accept=".zip"
              type="file"
              @change="(e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) onLatexZipUpload(file);
              }"
          />
        </label>
        <label class="start-button upload-label" @click="handleStartDemo">🎬 Start Tour</label>
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
                v-model="selectedMainTex"
                :value="file.path"
                name="mainTex"
                type="radio"
            />
            📄 {{ file.path }}
          </label>

          <span v-else class="latex-file muted">
          {{ file.type === 'image' ? '🖼' : '📦' }} {{ file.path }}
        </span>
        </li>
      </ul>

      <button
          :disabled="!selectedMainTex"
          class="start-button"
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

</template>

<style scoped>



.demo-overlay {
  position: fixed;
  inset: 0;
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
  -webkit-mask: linear-gradient(#fff 0 0) content-box,
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
  -webkit-mask: linear-gradient(#fff 0 0) content-box,
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

