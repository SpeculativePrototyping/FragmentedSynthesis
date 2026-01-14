<script setup lang="ts">
import {inject, ref, type Ref} from 'vue'
import type {ImageCacheEntry} from "@/App.vue";



type ImageCache = Record<string, ImageCacheEntry>

// Inject den bestehenden imageCache
const imageCache = inject<Ref<ImageCache>>('imageCache', ref({}))!

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
          <div class="figure-key">
            RefKey: <strong>{{ key }}</strong>
          </div>
          <div class="figure-caption">
            Caption:{{ img.latexLabel || '(no caption)' }}
          </div>
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
  flex-direction: column;   /* untereinander */
  gap: 2px;
  width: 100%;
  max-width: 100%;
  align-items: center;
}

.figure-key {
  font-weight: 600;
}

.figure-caption {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #ffffff;
}






</style>
