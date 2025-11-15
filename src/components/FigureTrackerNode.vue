<script setup lang="ts">
import { ref, inject, type Ref } from 'vue'

interface ImageCacheEntry {
  base64: string
  refLabel: string
}

type ImageCache = Record<string, ImageCacheEntry>

// ImageCache kommt z. B. aus globalem State oder Injection
const imageCache = inject<Ref<ImageCache>>('imageCache', ref({}))

// Optional: label wie bei Reference Tracker Node
const props = defineProps<{
  label?: string
}>()
</script>

<template>
  <div class="text-node doc-node node-wrapper" @wheel.stop>
    <header class="doc-node__header">
      <strong>{{ props.label ?? 'Figure Tracker Node' }}</strong>
    </header>

    <section class="text-node__body">
      <div v-if="!imageCache || Object.keys(imageCache).length === 0">
        This keeps track of all your figures and their keys, so you can reference them in your text. No images yet…
      </div>

      <ul v-else>
        <li v-for="(img, key) in imageCache" :key="key" class="figure-entry">
          <div class="figure-preview">
            <img :src="img.base64" alt="Figure preview" />
          </div>
          <div class="figure-info">
            Key: <strong>{{ img.refLabel }}</strong>
          </div>
        </li>
      </ul>
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
  max-height: 600px;
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

.text-node__body ul {
  list-style: none;        /* keine Bullets */
  padding: 0;              /* removes default ul padding */
  margin: 0;               /* removes default ul margin */
  display: flex;
  flex-direction: column;
  align-items: center;     /* zentriert die li Items horizontal */
  gap: 12px;               /* optional Abstand zwischen den Bildern */
}

.figure-entry {
  display: flex;
  flex-direction: column;
  align-items: center;     /* zentriert Bild und Text */
  padding: 8px 0;
  border-bottom: 1px solid #eee;
  width: 100%;             /* optional, damit der border-bottom über die ganze Breite geht */
  max-width: 350px;        /* optional, begrenzt die Breite der Einträge */
}

.figure-preview img {
  max-width: 100%;
  border-radius: 6px;
  margin-bottom: 4px;
}

.figure-info {
  font-size: 0.85rem;
}
</style>
