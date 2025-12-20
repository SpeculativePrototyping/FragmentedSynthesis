<script setup lang="ts">
import {inject, ref, type Ref} from 'vue'

interface ImageCacheEntry {
  base64: string
  refLabel: string
}

type ImageCache = Record<string, ImageCacheEntry>

// Inject den bestehenden imageCache
const imageCache = inject<Ref<ImageCache>>('imageCache', ref({}))!
const updateImageCache = inject<(newCache: ImageCache) => void>('updateImageCache', () => {})!

// Funktion zum Löschen eines Eintrags
function removeFigure(key: string) {
  if (!imageCache) return
  delete imageCache.value[key]
}
</script>

<template>
  <div class="figure-panel-content">
    <div v-if="!imageCache || Object.keys(imageCache).length === 0">
      No figures yet… Add some figures using Figure Nodes!
    </div>

    <ul v-else>
      <li v-for="(img, key) in imageCache" :key="key" class="figure-entry">
        <div class="figure-preview">
          <img :src="img.base64" alt="Figure preview" />
        </div>
        <div class="figure-info">
          Key: <strong>{{ img.refLabel }}</strong>
          <button class="figure-delete" @click="removeFigure(key)">×</button>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.figure-panel-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 500px;
  overflow-y: auto;
}

.figure-panel-content ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
}

.figure-entry {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #eee;
  width: 100%;
  max-width: 350px;
}

.figure-preview img {
  max-width: 100%;
  border-radius: 6px;
  margin-bottom: 4px;
}

.figure-info {
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 8px;
}

.figure-delete {
  border: none;
  background: transparent;
  color: #ff4444;
  cursor: pointer;
  font-weight: bold;
}
.figure-delete:hover {
  color: #ff0000;
  background: rgba(238, 238, 238, 0.5);
}
</style>
