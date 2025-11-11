<script setup lang="ts">
import {inject, type Ref, ref, watch, watchEffect} from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { useVueFlow } from '@vue-flow/core'


interface BibEntry {
  id: string
  type: string
  fields: Record<string, string>
}

// Props kommen jetzt direkt von App.vue
const props = defineProps<{
  label?: string
  bibliography: BibEntry[]
  updateBibliography: (newBib: BibEntry[]) => void
}>()

const TLDR = inject<Ref<boolean>>('TLDR') // injected reactive TLDR state


// ======= BibTeX Import =======
const rawBibtexInput = ref('')

function parseBibtex(input: string): BibEntry[] {
  const entries: BibEntry[] = []
  const blocks = input.split('@').map(b => b.trim()).filter(b => b)

  for (const block of blocks) {
    const match = block.match(/^(\w+)\s*\{\s*([^,]+)\s*,([\s\S]*?)\}\s*$/)
    if (!match) continue

    const [, type, id, body] = match

    const fields: Record<string, string> = {}
    body.split('\n').forEach(line => {
      const fieldMatch = line.match(/(\w+)\s*=\s*[\{"]([^"}]+)[\}"]/)
      if (fieldMatch) {
        fields[fieldMatch[1]] = fieldMatch[2]
      }
    })

    // Hier wird der rohe Block gespeichert
    entries.push({ id, type, fields, raw: `@${block}` })
  }

  return entries
}


function importBibtex() {
  const newEntries = parseBibtex(rawBibtexInput.value)

  // Filtere nur Einträge, die noch nicht existieren
  const uniqueNewEntries = newEntries.filter(
      entry => !props.bibliography.some(e => e.id === entry.id)
  )

  if (uniqueNewEntries.length > 0) {
    props.updateBibliography([...props.bibliography, ...uniqueNewEntries])
  }

  rawBibtexInput.value = ''
}


function formatEntry(entry: BibEntry): string {
  const authorsRaw = entry.fields.author || ''
  const authors = authorsRaw
      .split(/ and /i)
      .map(a => a.trim())
      .join('; ')

  const year = entry.fields.year || 'n.d.'
  const title = entry.fields.title || '(no title)'
  const key = entry.id

  return `${authors} (${year}). ${title}. → Key: ${key}`
}

function removeReference(key: string) {
  const newBib = props.bibliography.filter(entry => entry.id !== key)
  props.updateBibliography(newBib)
}



</script>

<template>
  <div class="text-node doc-node node-wrapper" @wheel.stop>
    <header class="doc-node__header">
      <strong>{{ props.label ?? 'Reference Tracker' }}</strong>
    </header>

    <section class="text-node__body">
      <h4>Bibliography</h4>

      <div v-if="props.bibliography.length === 0" >No sources yet…</div>
      <ul v-else>
        <li v-for="(entry, i) in props.bibliography" :key="entry.id" class="bib-entry">
          {{ i + 1 }}. {{ formatEntry(entry) }}
          <button class="bib-entry-delete" @click="removeReference(entry.id)">×</button>
        </li>
      </ul>

      <h4>Add Reference</h4>
      <textarea
          v-model="rawBibtexInput"
          class="reftracker__textarea"
          placeholder="Paste BibTeX entries here..."
          @wheel.stop
      />
      <button
          type="button"
          class="reftracker__import-btn"
          @click="importBibtex"
      >
        Import BibTeX
      </button>
    </section>
  </div>
</template>

<style scoped>
.text-node { overflow: visible; }
.node-wrapper { position: relative; }

.doc-node__header {
  font-weight: bold;
  padding: 10px 12px;
  border-radius: 10px 10px 0 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.text-node__body {
  min-height: 400px;
  max-height: 1000px;
  width: 400px;
  padding: 10px 12px;
  border: 1px solid rgba(15,23,42,.15);
  border-radius: 0 0 10px 10px;
  background: #fff;
  overflow-y: auto;
  font-family: inherit;
  font-size: 0.9rem;
  line-height: 1.2;
  resize: vertical;
}

.reftracker__textarea {
  width: 100%;          /* volle Breite des Containers */
  min-height: 100px;
  padding: 10px 12px;
  border: 1px solid rgba(15,23,42,.15);
  border-radius: 10px;
  background: #fff;
  font: inherit;
  line-height: 1.45;
  resize: none;
  box-sizing: border-box; /* Padding wird in Breite eingerechnet */
}

.reftracker__textarea:focus {
  outline: 2px solid rgba(99,102,241,.45);
  border-color: rgba(99,102,241,.45);
}

.reftracker__import-btn {
  width: 100%;          /* volle Breite */
  height: 50px;
  border-radius: 10px;
  border: 1px solid #ccc;
  background: #f7f7f7;
  cursor: pointer;
  font-size: 0.9rem;
  margin-top: 10px;
  box-sizing: border-box; /* Padding in Breite einrechnen */
}

.reftracker__import-btn:hover {
  background: #eee;
}

.bib-entry {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
}

.bib-entry-delete {
  border: none;
  background: transparent;
  color: #ff4444;
  cursor: pointer;
  font-weight: bold;
  margin-left: 8px;
}
.bib-entry-delete:hover {
  color: #ff0000;
}


</style>
