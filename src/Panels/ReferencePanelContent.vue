<script setup lang="ts">
import { ref, inject, type Ref } from 'vue'
import type {BibEntry} from "@/App.vue";



// inject die bestehende Bibliography
const bibliography = inject<Ref<BibEntry[]>>('bibliography', ref([]))!
const updateBibliography = inject<(newBib: BibEntry[]) => void>('updateBibliography')!

// lokale Variable für BibTeX Input
const rawBibtexInput = ref('')

// ======= BibTeX Import =======
function parseBibtex(input: string): BibEntry[] {
  const entries: BibEntry[] = []
  const blocks = input.split('@').map(b => b.trim()).filter(b => b)
  for (const block of blocks) {
    const match = block.match(/^(\w+)\s*\{\s*([^,]+)\s*,([\s\S]*?)\}\s*$/)
    if (!match) continue
    const [, type, id, body] = match
    const fields: Record<string,string> = {}
    body.split('\n').forEach(line => {
      const fieldMatch = line.match(/(\w+)\s*=\s*[\{"]([^"}]+)[\}"]/)
      if (fieldMatch) fields[fieldMatch[1]] = fieldMatch[2]
    })
    entries.push({ id, type, fields, raw: `@${block}` })
  }
  return entries
}

function importBibtex() {
  const newEntries = parseBibtex(rawBibtexInput.value)
  const uniqueNewEntries = newEntries.filter(
      entry => !bibliography.value.some(e => e.id === entry.id)
  )
  if (uniqueNewEntries.length > 0) {
    updateBibliography([...bibliography.value, ...uniqueNewEntries])
  }
  rawBibtexInput.value = ''
}

function formatEntry(entry: BibEntry): string {
  const authorsRaw = entry.fields.author || ''
  const authors = authorsRaw.split(/ and /i).map(a => a.trim()).join('; ')
  const year = entry.fields.year || 'n.d.'
  const title = entry.fields.title || '(no title)'
  const key = entry.id
  return `${authors} (${year}). ${title}. → Key: ${key}`
}

function removeReference(key: string) {
  const newBib = bibliography.value.filter(entry => entry.id !== key)
  updateBibliography(newBib)
}
</script>

<template>
  <div class="reference-panel-content">
    <div v-if="bibliography.length === 0">
      No references yet… Add some via BibTeX.
    </div>

    <ul v-else>
      <li v-for="(entry, i) in bibliography" :key="entry.id" class="bib-entry">
        {{ i + 1 }}. {{ formatEntry(entry) }}
        <button class="bib-entry-delete" @click="removeReference(entry.id)">🗑️</button>
      </li>
    </ul>

    Add References:
    <textarea
        v-model="rawBibtexInput"
        class="reftracker__textarea"
        placeholder="Paste BibTeX entries here..."
    />
    <button class="import-btn" @click="importBibtex">
      Import BibTeX
    </button>
  </div>
</template>

<style scoped>
.reference-panel-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 500px;
  overflow-y: auto;
}

.reftracker__textarea {
  width: 100%;
  min-height: 100px;
  padding: 10px 12px;
  border: 1px solid rgba(15,23,42,.15);
  border-radius: 10px;
  background: #fff;
  font: inherit;
  line-height: 1.45;
  resize: none;
  box-sizing: border-box;
}



.bib-entry {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
}

.bib-entry-delete {
  margin: 4px;
  background: rgb(255, 255, 255);
  cursor: pointer;
  font-weight: 600;
  font-size: 1rem;
  box-sizing: border-box;
  padding: 8px 12px;
  border-radius: 10px;
}
.bib-entry-delete:hover {
  background: rgba(0, 0, 0, 0);
}

.import-btn {
  width: 100%;
  border-radius: 10px;
  background: rgb(255, 255, 255);
  cursor: pointer;
  font-weight: 600;
  font-size: 1rem;
  margin-top: 10px;
  box-sizing: border-box;
  color: #000000;
  padding: 8px 12px;

}

.import-btn:hover {
  background: rgba(0, 0, 0, 0);
}

.template-buttons button {
  margin: 4px;
  background: rgb(255, 255, 255);
  cursor: pointer;
  font-weight: 600;
  font-size: 1rem;
  box-sizing: border-box;
  padding: 8px 12px;
  border-radius: 10px;

}

.template-buttons button:hover {
  background: rgba(0, 0, 0, 0);
}

</style>
