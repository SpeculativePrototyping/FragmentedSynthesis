<script setup lang="ts">
import { ref, inject, type Ref } from 'vue'


interface StyleTemplate {
  templateName: string
  tone: string
  sectionLength: number
  emphasizePoints: string
}

// Inject global templates
const templates = inject<Ref<StyleTemplate[]>>('styleTemplates')!
const setTemplates = inject<(newList: StyleTemplate[]) => void>('setStyleTemplates')!

const templateName = ref('')
const tone = ref('')
const sectionLength = ref(0)
const emphasizePoints = ref('')

const editingIndex = ref<null | number>(null)
const addingNew = ref(false)

function clearFields() {
  templateName.value = ''
  tone.value = ''
  sectionLength.value = 0
  emphasizePoints.value = ''
}

function saveTemplate() {
  if (!templateName.value.trim()) return

  const newTemplate: StyleTemplate = {
    templateName: templateName.value,
    tone: tone.value,
    sectionLength: sectionLength.value,
    emphasizePoints: emphasizePoints.value
  }

  let updated = [...templates.value]

  if (editingIndex.value === null) {
    updated.push(newTemplate)
  } else {
    updated[editingIndex.value] = newTemplate
  }

  setTemplates(updated)

  clearFields()
  editingIndex.value = null
  addingNew.value = false
}

function editTemplate(index: number) {
  const t = templates.value[index]
  templateName.value = t.templateName
  tone.value = t.tone
  sectionLength.value = t.sectionLength
  emphasizePoints.value = t.emphasizePoints
  editingIndex.value = index
  addingNew.value = false
}

function deleteTemplate(index: number) {
  const updated = templates.value.filter((_, i) => i !== index)
  setTemplates(updated)

  clearFields()
  editingIndex.value = null
  addingNew.value = false
}
</script>


<template>
  <div class="style-panel-content">

    <!-- Formular für neues oder bearbeitetes Template -->
    <div v-if="templates.length === 0 || addingNew || editingIndex !== null" class="form-group-wrapper">
      <div class="form-group">
        <label>
          Template Name
          <span class="char-counter">
      {{ templateName.length }}/40
    </span>
        </label>

        <textarea
            v-model="templateName"
            maxlength="40"
            placeholder="Give your style template a designation. You can choose a template later when using the Paraphrase Node."
        ></textarea>
      </div>


      <div class="form-group">
        <label>Tone / Style / Target Audience</label>
        <textarea v-model="tone" placeholder="Describe your target audience or the desired tone."></textarea>
      </div>

      <div class="form-group">
        <label>Paragraph Length (Sentences)</label>
        <input type="number" v-model="sectionLength" min="1" max="200" />
      </div>

      <div class="form-group">
        <label>Examples</label>
        <textarea v-model="emphasizePoints" placeholder="Snippet or example for how you'd like your text to be written. The example will determine the length of your paragraph in case you did not set a paragraph length above." rows="4"></textarea>
      </div>

      <button class="import-btn" @click="saveTemplate">💾 Save Template</button>
    </div>

    <!-- Liste vorhandener Templates -->
    <div v-if="templates.length > 0" class="template-list">
      <div v-for="(t, index) in templates" :key="index" class="template-item">
        <span>{{ t.templateName }}</span>
        <div class="template-buttons">
          <button @click="editTemplate(index)" title="Edit Template">✏️</button>
          <button @click="deleteTemplate(index)" title="Delete Template" style="color: red;">🗑️</button>
        </div>
      </div>

      <button class="import-btn" @click="addingNew = true; clearFields()">➕ Add New Template</button>
    </div>
  </div>
</template>

<style scoped>
.style-panel-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.form-group-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

input, textarea {
  border-radius: 6px;
  border: 1px solid #ccc;
  padding: 4px 6px;
  font-family: inherit;
  font-size: 0.9rem;
}

textarea {
  resize: vertical;
}


.template-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.template-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
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
</style>
