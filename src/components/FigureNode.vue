<script setup lang="ts">
import {ref, computed, watch, inject, type Ref, onMounted, onBeforeUnmount} from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import type { NodeProps } from '@vue-flow/core'
import {NodeToolbar} from "@vue-flow/node-toolbar";
import '../styles/NodeDesign.css'
import type {BibEntry, ImageCache} from "@/App.vue";


interface FigureNodeData {
  label?: string
  citations?: string[]
  image?: string      // Base64
  imageName?: string  // Filename
  latexLabel?: string // Figure-Name for LaTeX
  refLabel?: string
  width?: number
  height?: number
}

interface FigureNodeProps extends NodeProps<FigureNodeData> {}

const bibliography = inject<Ref<BibEntry[]>>('bibliography')!
const props = defineProps<FigureNodeProps>()
const { updateNodeData, removeNodes } = useVueFlow()


const refLabel = ref(props.data?.refLabel ?? randomRefLabel())


const imageSrc = computed(() => {
  // falls direkte Base64 im Node gespeichert ist
  if (props.data?.image) return props.data.image as string

  // ansonsten das zentrale imageCache-Objekt verwenden (bestehender Ansatz)
  const name = props.data?.imageName
  if (name && imageCache?.value?.[name]) return imageCache.value[name].base64

  return undefined
})



function randomRefLabel(length = 5) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `Figure-${result}`
}



const imageCache = inject<Ref<ImageCache>>('imageCache')

const nodeRef = ref<HTMLElement | null>(null)
let resizeObs: ResizeObserver | null = null
let resizeRaf: number | null = null

// Zentral: Alle Bibliographie-Einträge
const availableSources = computed(() => bibliography.value)

// TLDR / Compact
const TLDR = inject('TLDR')
const isCompact = ref(false)
watch(TLDR, (val) => {
  if (typeof val === 'boolean') isCompact.value = val
})

// Lokale Reactive States
const searchQuery = ref('')
const showSearch = ref(false)
const latexLabel = ref(props.data?.latexLabel ?? '')

// 🔹 Zentrale Funktion: synchronisiert alles an downstream-Nodes
function syncDataDownstream(updated: Partial<FigureNodeData> = {}) {
  updateNodeData(props.id, {
    label: props.data.label,
    citations: props.data.citations ?? [],
    image: props.data.image,
    imageName: props.data.imageName,
    latexLabel: latexLabel.value,
    refLabel: refLabel.value,
    ...updated
  })
}

// Filter für Suchfunktion
const filteredSources = computed(() => {
  if (!searchQuery.value) return availableSources.value
  const query = searchQuery.value.toLowerCase()
  return availableSources.value.filter(entry =>
      (entry.fields.author ?? '').toLowerCase().includes(query) ||
      (entry.fields.title ?? '').toLowerCase().includes(query) ||
      entry.id.toLowerCase().includes(query)
  )
})

// Citations Management
function addCitationByKey(key: string) {
  const citations = props.data.citations ? [...props.data.citations] : []
  if (!citations.includes(key)) {
    citations.push(key)

    // Zitat ans Ende der Bildbeschreibung anhängen
    const newLatexLabel = latexLabel.value
        ? `${latexLabel.value} ~\\cite{${key}}`
        : `~\\cite{${key}}`

    latexLabel.value = newLatexLabel
    syncDataDownstream({ citations })
  }

  searchQuery.value = ''
  showSearch.value = false
}

function removeCitation(key: string) {
  const citations = props.data.citations ? [...props.data.citations] : []
  const newCitations = citations.filter(c => c !== key)

  // Entferne alle Vorkommen von ~\cite{key} aus latexLabel
  latexLabel.value = latexLabel.value.replace(new RegExp(`~\\\\cite\\{${key}\\}`, 'g'), '').trim()
  syncDataDownstream({ citations: newCitations })
}

// Bibliography-Update Watcher
watch(bibliography, (newBib) => {
  if (!props.data.citations) return

  const validCitations = props.data.citations.filter(key =>
      newBib.some(entry => entry.id === key)
  )

  if (validCitations.length !== props.data.citations.length) {
    syncDataDownstream({ citations: validCitations })
  }
}, { deep: true })


watch(latexLabel, () => {
  const key = props.data?.imageName
  if (key && imageCache?.value?.[key]) {
    imageCache.value[key].latexLabel = latexLabel.value
  }

  syncDataDownstream({ refLabel: refLabel.value })
})


function scanCitationsFromLatexLabel() {
  if (!props.data) return

  const currentCitations = new Set<string>()
  const matches = latexLabel.value.matchAll(COMPLETE_CITATION_REGEX)

  for (const match of matches) {
    const key = match[1].trim()
    if (key) currentCitations.add(key)
  }

  if (currentCitations.size > 0) {
    syncDataDownstream({ citations: Array.from(currentCitations) })
  }
}


// File upload
function onFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file || !imageCache) return

  const reader = new FileReader()
  reader.onload = () => {
    // alten Cache-Eintrag löschen, falls vorhanden
    if (props.data?.imageName && imageCache.value[props.data.imageName]) {
      delete imageCache.value[props.data.imageName]
    }

    const cacheKey = `${refLabel.value}` // kanonischer Key

    imageCache.value[cacheKey] = {
      base64: reader.result as string,
      refLabel: refLabel.value,
      latexLabel: latexLabel.value,
    }

    syncDataDownstream({
      imageName: cacheKey,
      image: undefined,
      refLabel: refLabel.value,
    })
  }

  reader.readAsDataURL(file)
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

const COMPLETE_CITATION_REGEX = /~\\cite\{([^\}]+)\}/g

let citationTimer: number | undefined

watch(latexLabel, (currentLabel) => {
  window.clearTimeout(citationTimer)
  citationTimer = window.setTimeout(() => {
    if (!props.data) return

    const currentCitations = new Set(props.data.citations ?? [])
    const matches = currentLabel.matchAll(COMPLETE_CITATION_REGEX)
    let changed = false

    for (const match of matches) {
      const key = match[1].trim()
      if (key && !currentCitations.has(key)) {
        currentCitations.add(key)
        changed = true
      }
    }

    // Alte Citations entfernen, die nicht mehr im Label vorkommen
    for (const key of props.data.citations ?? []) {
      if (!currentLabel.includes(`~\\cite{${key}}`)) {
        currentCitations.delete(key)
        changed = true
      }
    }

    if (changed) {
      syncDataDownstream({ citations: Array.from(currentCitations) })
    }
  }, 5000)
})

onMounted(() => {

  // Wenn Node beim Laden schon ein Bild hat, in den Cache eintragen
  if (props.data?.image && props.data.imageName && imageCache) {
    imageCache.value[props.data.imageName] = {
      base64: props.data.image,
      refLabel: refLabel.value,
      latexLabel: latexLabel.value,
    }

    // Optional: Node selbst speichert dann nur den Key
    syncDataDownstream({ image: undefined })
  }

  // 2️⃣ Citation-Scan einmalig
  scanCitationsFromLatexLabel()

  // ResizeObserver wie gehabt
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
      updateNodeData(props.id, { ...(props.data ?? {}), width, height })
    })
  })
  resizeObs.observe(nodeRef.value)
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

      <button
          class="toolbar-mini-btn"
          :class="{ active: showSearch }"
          @click="showSearch = !showSearch"
          title="Cite Sources"
      >
        📚
      </button>

      <label class="mini-toggle-switch" title="Compact view / TLDR">
        <input type="checkbox" v-model="isCompact"/>
        <span class="slider"></span>
      </label>
      <span class="mini-toggle-label">TLDR</span>
    </div>
  </NodeToolbar>

  <div class="text-node doc-node node-wrapper" ref="nodeRef">
    <header class="doc-node__header">
      <strong>
        {{ isCompact ? "🖼️  " + latexLabel || 'Figure Node' : props.data?.label ?? 'Figure Node' }}
      </strong>
    </header>

    <section class="doc-node__body" v-if="!isCompact">
      <input
          v-if="!props.data?.image"
          type="file"
          accept="image/*"
          @change="onFileChange"
          class="citation-item-input"
      />

      <div v-if="imageSrc" class="image-preview">
        <img :src="imageSrc" alt="Uploaded figure" />
        <p>{{ props.data.imageName ?? props.data.imageName }}</p>
      </div>


      <textarea
          type="text"
          v-model="latexLabel"
          @wheel.stop
          placeholder="Upload a figure, give it a caption and add a reference. Type here..."
          class="figure-node__label-input"
      />

      <!-- Citations UI -->
      <div class="citations-ui">
        <div class="selected-citations">
          <span
              v-for="key in props.data.citations ?? []"
              :key="key"
              class="citation-tag"
          >
            {{ key }}
            <button @click="removeCitation(key)">×</button>
          </span>
        </div>
        <div v-if="showSearch" class="citation-search">
          <input
              v-model="searchQuery"
              class="citation-search-input"
              placeholder="Search references..."
          />
          <ul class="citation-search-list" @wheel.stop>
            <li v-for="entry in filteredSources" :key="entry.id" @click="addCitationByKey(entry.id)">
              <span class="key">{{ entry.id }}</span>
            </li>

          </ul>
        </div>
      </div>
    </section>

    <Handle id="output" type="source" :position="Position.Right" />
  </div>
</template>

<style scoped>
/* exact same styles as TextAreaNode */
.node-wrapper {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
  width: 100%;
  max-width: 650px;
  height: 100%;
}


.doc-node__header strong {
  display: block;
  max-width: 100%;
  white-space: nowrap;      /* verhindert Zeilenumbruch */
  overflow: hidden;         /* überschüssigen Text ausblenden */
  text-overflow: ellipsis;  /* "..." am Ende */
}

.doc-node__body {
  display: flex;
  flex-direction: column;
  height: 100%;
}


.image-preview img {
  width: 100%;   /* passt sich Containerbreite an */
  max-width: 500px;
  height: auto;
  display: block;
  margin: 0 auto 6px;
}

.node-hover-toggle {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}

.node-wrapper:hover .node-hover-toggle {
  opacity: 1;
  pointer-events: auto;
}

.figure-node__label-input {
  min-width: 350px;
  width: 100%;
  min-height: 100px;
  height: 100px;
  margin: 0 auto;
  padding: 10px 12px;
  border: 1px solid rgba(15,23,42,.15);
  border-radius: 10px;
  background: #fff;
  font: inherit;
  line-height: 1.45;
  resize: none;
  box-sizing: border-box;
}

.figure-node__label-input:focus {
  outline: 2px solid rgba(99,102,241,.45);
  border-color: rgba(99,102,241,.45);
}


</style>
