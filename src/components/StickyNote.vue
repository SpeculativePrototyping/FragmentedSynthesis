<script setup lang="ts">
import {ref, watch, inject, type Ref} from 'vue'
import { Handle, Position,  useVueFlow } from '@vue-flow/core'
import type { NodeProps } from '@vue-flow/core'
import {NodeToolbar} from "@vue-flow/node-toolbar";
import '../styles/NodeDesign.css'

interface StickyNoteData {
  value?: string
  label?: string
  placeholder?: string
}

const props = defineProps<NodeProps<StickyNoteData>>()
const { updateNodeData, removeNodes } = useVueFlow()
const text = ref<string>(String(props.data?.value ?? ''))

const TLDR = inject<Ref<boolean>>('TLDR') // injected reactive TLDR state

// Debounced push to Vue Flow state so downstream nodes can read `data.value`
let timer: number | undefined
watch(text, (v) => {
  window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    updateNodeData(props.id, { ...props.data, value: v })
  }, 150)
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
    </div>
  </NodeToolbar>
  <div class="text-node doc-node" >
    <header class="doc-node__header">
      <strong>{{ props.data?.label ?? 'Text' }}</strong>
    </header>

    <section class="doc-node__body">
      <textarea
          @wheel.stop
          v-model="text"
          rows="6"
          class="text-node__textarea"
          :placeholder="props.data?.placeholder ?? 'Notes, thoughts and reminders go here...'"
          spellcheck="true"
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
  width: 240px;
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

</style>