<script setup lang="ts">
import { ref, watch, inject, type Ref, onMounted } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import type { NodeProps } from '@vue-flow/core'

interface StickyNoteData {
  value?: string
  label?: string
  placeholder?: string
}

const props = defineProps<NodeProps<StickyNoteData>>()
const { updateNodeData } = useVueFlow()
const text = ref<string>(String(props.data?.value ?? ''))

const TLDR = inject<Ref<boolean>>('TLDR') // injected reactive TLDR state

// Debounced push to Vue Flow state
let timer: number | undefined
watch(text, (v) => {
  window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    updateNodeData(props.id, { ...props.data, value: v })
  }, 150)
})

// Schwebeeffekt
const floatOffset = ref(0)
let direction = 1
onMounted(() => {
  setInterval(() => {
    if (floatOffset.value > 4) direction = -1
    if (floatOffset.value < -4) direction = 1
    floatOffset.value += direction * 0.3
  }, 50)
})

// Augenbewegung
const eyeOffset = ref(0)
let eyeDir = 1
onMounted(() => {
  setInterval(() => {
    if (eyeOffset.value > 1.5) eyeDir = -1
    if (eyeOffset.value < -1.5) eyeDir = 1
    eyeOffset.value += eyeDir * 0.2
  }, 200)
})

// Blinzeln
const isBlinking = ref(false)
onMounted(() => {
  setInterval(() => {
    isBlinking.value = true
    setTimeout(() => (isBlinking.value = false), 150)
  }, 4000 + Math.random() * 3000) // zufälliges Blinzeln alle 4-7 Sekunden
})

// Mundbewegung (leichtes Öffnen und Schließen)
const mouthOffset = ref(0)
let mouthDir = 1
onMounted(() => {
  setInterval(() => {
    if (mouthOffset.value > 2) mouthDir = -1
    if (mouthOffset.value < 0) mouthDir = 1
    mouthOffset.value += mouthDir * 0.2
  }, 200)
})
</script>

<template>
  <div
      class="text-node doc-node"
      :style="{ transform: `translateY(${floatOffset}px)` }"
  >
    <header class="doc-node__header">
      <strong>{{ props.data?.label ?? 'Text' }}</strong>

      <!-- TourGuide Gesicht -->
      <div class="tourguide-face">
        <div class="eyes">
          <div
              class="eye left"
              :style="{
              transform: `translateX(${eyeOffset}px) scaleY(${isBlinking ? 0.1 : 1})`
            }"
          ></div>
          <div
              class="eye right"
              :style="{
              transform: `translateX(${eyeOffset}px) scaleY(${isBlinking ? 0.1 : 1})`
            }"
          ></div>
        </div>
        <div
            class="mouth"
            :style="{ height: `${4 + mouthOffset}px` }"
        ></div>
      </div>
    </header>

    <section class="doc-node__body">
      <textarea
          @wheel.stop
          v-model="text"
          rows="6"
          class="text-node__textarea"
          :placeholder="props.data?.placeholder ?? 'Notes, thoughts and reminders go here...'"
          spellcheck="false"
          autocapitalize="sentences"
          autocomplete="on"
          data-gramm="true"
          data-gramm_editor="true"
          aria-label="Text node editor"
      />
    </section>
  </div>
</template>

<style scoped>
.text-node {
  overflow: visible;
  background: rgb(248,210,0);
}

.text-node__textarea {
  width: 400px;
  height: 300px;
  min-width: 240px;
  min-height: 140px;
  max-width: 480px;
  max-height: 400px;
  padding: 10px 12px;
  border: 1px solid rgba(15,23,42,.15);
  border-radius: 10px;
  background: rgb(248,210,0);
  font: inherit;
  line-height: 1.45;
  resize: both;
}

.text-node__textarea:focus {
  outline: none;
}

/* TourGuide Gesicht */
.tourguide-face {
  position: absolute;
  top: 5px;
  right: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.tourguide-face .eyes {
  display: flex;
  gap: 4px;
}

.tourguide-face .eye {
  width: 6px;
  height: 6px;
  background: black;
  border-radius: 50%;
  transition: transform 0.15s linear;
}

.tourguide-face .mouth {
  width: 12px;
  border-bottom: 2px solid black;
  border-radius: 2px;
  margin-top: 2px;
  transition: height 0.2s ease;
}
</style>
