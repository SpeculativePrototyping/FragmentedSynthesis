<script setup lang="ts">
import { inject, type Ref } from 'vue'

interface Snapshot {
  id: string
  name: string
  createdAt: number
  data: any
  screenshot?: string
}

const snapshots = inject<Ref<Snapshot[]>>('snapshots')!
const restoreSnapshot = inject<(id: string) => void>('restoreSnapshot')!
const deleteSnapshot = inject<(id: string) => void>('deleteSnapshot')!

function handleRestore(snap: Snapshot) {
  restoreSnapshot(snap.id)
}

function handleDelete(snap: Snapshot) {
  deleteSnapshot(snap.id)
}
</script>

<template>
  <div class="style-panel-content">
    <div v-if="snapshots.length === 0">
      No snapshots yet 📸
    </div>

    <div v-for="snap in snapshots" :key="snap.id" class="snapshot-card">
      <!-- Screenshot -->
      <img v-if="snap.screenshot" :src="snap.screenshot" class="snapshot-image" />

      <!-- Name -->
      <div class="snapshot-name">{{ snap.name }}</div>

      <!-- Buttons -->
      <div class="template-buttons">
        <button @click="handleRestore(snap)" title="Restore">♻️</button>
        <button @click="handleDelete(snap)" title="Delete" style="color:red">🗑️</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.style-panel-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* Card für jeden Snapshot */
.snapshot-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 8px;
}

/* Screenshot füllt die volle Breite */
.snapshot-image {
  width: 100%;
  height: auto;
  border-radius: 6px;
  object-fit: contain; /* Bild wird nicht verzerrt */
  border: 1px solid #ccc;
}

/* Name unter dem Bild */
.snapshot-name {
  font-weight: 600;
  font-size: 0.95rem;
  text-align: left;
  color: #fff;
  padding: 2px 0;
}

/* Buttons unter dem Namen, horizontal */
.template-buttons {
  display: flex;
  justify-content: flex-start;
  gap: 6px;
  padding-top: 4px;
}

.template-buttons button {
  font-size: 0.9rem; /* Größe bleibt wie vorher */
  padding: 6px 10px;
}
</style>

