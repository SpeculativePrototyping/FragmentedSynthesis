<script setup lang="ts">
import {ref, computed, watch, inject, type Ref} from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import type { NodeProps } from '@vue-flow/core'

interface BibEntry {
  id: string
  type: string
  fields: Record<string, string>
}

interface FigureNodeData {
  label?: string
  citations?: string[]
  image?: string      // Base64
  imageName?: string  // Filename
  latexLabel?: string // Figure-Name for LaTeX
  refLabel?: string
}

interface FigureNodeProps extends NodeProps<FigureNodeData> {
  bibliography: BibEntry[]
  updateBibliography?: (newBib: BibEntry[]) => void
}

const props = defineProps<FigureNodeProps>()
const { updateNodeData } = useVueFlow()
const refLabel = computed(() => {
  if (!latexLabel.value) return ''
  return latexLabel.value.split(/~\\cite\{/)?.[0]?.trim() ?? '' // Alles vor dem ersten ~\cite{...} als Label
})

interface ImageCacheEntry {
  base64: string
  refLabel: string
}

type ImageCache = Record<string, ImageCacheEntry>

const imageCache = inject<Ref<ImageCache>>('imageCache')



// Zentral: Alle Bibliographie-Einträge
const availableSources = computed(() => props.bibliography ?? [])

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
    refLabel: latexLabel.value?.split(/~\\cite\{/)?.[0]?.trim() ?? '',
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
watch(
    () => props.bibliography,
    (newBib) => {
      if (!props.data.citations) return

      const validCitations = props.data.citations.filter(key =>
          newBib.some(entry => entry.id === key)
      )

      if (validCitations.length !== props.data.citations.length) {
        syncDataDownstream({ citations: validCitations })
      }
    },
    { deep: true }
)

watch(latexLabel, () => {
  syncDataDownstream()

  // 🆕 globalen Cache aktuell halten
  if (props.data?.imageName && imageCache?.value[props.data.imageName]) {
    imageCache.value[props.data.imageName].refLabel =
        latexLabel.value.split(/~\\cite\{/)?.[0]?.trim() ?? ''
  }
})


// File upload
function onFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file || !imageCache) return

  const reader = new FileReader()
  reader.onload = () => {
    // zufälligen eindeutigen Namen erzeugen
    const randomName = `${crypto.randomUUID()}.${file.name.split('.').pop()}`

    // Base64 zentral speichern
    imageCache.value[randomName] = {
      base64: reader.result as string,
      refLabel: latexLabel.value.split(/~\\cite\{/)?.[0]?.trim() ?? ''
    }

    // Node nur den generierten Namen speichern
    syncDataDownstream({
      imageName: randomName,
      image: undefined // Base64 nicht im Node-State
    })
  }
  reader.readAsDataURL(file)
}

</script>


<template>
  <div class="text-node doc-node node-wrapper">
    <!-- TLDR toggle -->
    <div class="node-hover-toggle">
      <label class="toggle-switch" title="Compact view / TLDR">
        <input type="checkbox" v-model="isCompact"/>
        <span class="slider"></span>
      </label>
      <span class="toggle-label">TLDR</span>
    </div>

    <header class="doc-node__header">
      <strong>{{ props.data?.label ?? 'Figure' }}</strong>
    </header>

    <section class="doc-node__body">
      <!-- File upload, nur sichtbar wenn kein Bild vorhanden -->
      <input
          v-if="!props.data?.image"
          type="file"
          accept="image/*"
          @change="onFileChange"
          class="citation-item-input"
      />

      <!-- Bildvorschau / kompakte Ansicht -->
      <div v-if="props.data?.imageName && !isCompact" class="image-preview">
        <img :src="imageCache?.[props.data.imageName]?.base64" alt="Uploaded figure" />
        <p>{{ props.data.imageName }}</p>
      </div>


      <div v-else-if="isCompact">
        <p>{{ props.data?.imageName ?? 'No file selected' }}</p>
      </div>

      <input
          type="text"
          v-model="latexLabel"
          placeholder="Figure name and references:"
          class="figure-node__label-input"
      />

      <!-- Citations UI -->
      <div v-if="!isCompact" class="citations-ui">
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

        <button @click="showSearch = !showSearch" class="citation-add-btn">
          + Add Reference
        </button>

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
  width: 650px;
  height: 100%;
}

.doc-node__body {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.image-preview img {
  width: 600px;
  max-height: 200px;
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

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 28px;
  height: 16px;
}

.toggle-switch input {
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
  content: "";
  position: absolute;
  height: 12px;
  width: 12px;
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
  transform: translateX(12px);
}

.toggle-label {
  font-size: 0.75rem;
  color: #000;
}

.citations-ui {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  box-sizing: border-box;
  margin: 0 auto;
}

.selected-citations {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.citation-tag {
  background: #e0e7ff;
  padding: 4px 8px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.citation-tag button {
  border: none;
  background: transparent;
  cursor: pointer;
}

.citation-add-btn {
  width: 100%;
  border-radius: 10px;
  border: 1px solid #ccc;
  background: #f7f7f7;
  padding: 8px;
  cursor: pointer;
}

.citation-add-btn:hover {
  background: #eee;
}

.citation-search-input {
  width: 100%;
  height: 35px;
  padding: 8px;
  border-radius: 6px;
  border: 1px solid rgba(15,23,42,.15);
  margin-bottom: 8px;
  box-sizing: border-box;
}

.citation-search-list {
  max-height: 160px;
  min-height: 35px;
  overflow-y: auto;
  background: #fff;
  border: 1px solid rgba(15,23,42,.15);
  border-radius: 6px;
  padding: 4px;
  box-sizing: border-box;
}

.citation-search-list li {
  display: flex;
  flex-direction: row;
  gap: 6px;
  width: 100%;
  cursor: pointer;
  padding: 6px;
  box-sizing: border-box;
}

.citation-search-list li:hover {
  background: #eee;
}

.citation-search-list li span.key {
  font-weight: bold;
  flex-shrink: 0;
}

.citation-search-list li span.title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.figure-node__label-input {
  width: 600px;
  margin: 0 auto 12px;   /* Abstand nach unten */
  min-height: 15px;
  padding: 10px 12px;
  border: 1px solid rgba(15,23,42,.15);
  border-radius: 10px;
  background: #fff;
  font: inherit;
  line-height: 1.45;
}

.figure-node__label-input:focus {
  outline: 2px solid rgba(99,102,241,.45);
  border-color: rgba(99,102,241,.45);
}

</style>
