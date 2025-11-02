<script setup lang="ts">
import { ref, watch } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import type { NodeProps } from '@vue-flow/core'

interface TextNodeData {
  value?: string
  label?: string
  placeholder?: string
}

const props = defineProps<NodeProps<TextNodeData>>()
const { updateNodeData } = useVueFlow()


const text = ref<string>(String(props.data?.value ?? ''))

// Debounced push to Vue Flow state so downstream nodes can read `data.value`
let timer: number | undefined
watch(text, (v) => {
  window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    updateNodeData(props.id, { ...props.data, value: v })
  }, 150)
})
</script>

<template>
  <div class="text-node doc-node" >
    <header class="doc-node__header">
      <strong>{{ props.data?.label ?? 'Text' }}</strong>
    </header>

    <section class="doc-node__body">
      <textarea
        v-model="text"
        rows="6"
        class="text-node__textarea"
        :placeholder="props.data?.placeholder ?? 'This node is for text input. Type here and connect it to other nodes...'"
        spellcheck="true"
        autocapitalize="sentences"
        autocomplete="on"
        data-gramm="true"
        data-gramm_editor="true"
        aria-label="Text node editor"
      />
    </section>

    <Handle id="output" type="source" :position="Position.Right" />
  </div>
</template>



<style scoped>
.text-node { overflow: visible; }

.text-node__textarea {
  width: 240px;
  min-width: 240px;
  min-height: 140px;
  max-width: 480px;
  max-height: 400px;
  padding: 10px 12px;
  border: 1px solid rgba(15,23,42,.15);
  border-radius: 10px;
  background: #fff;
  font: inherit;
  line-height: 1.45;
  resize: both;
}

.text-node__textarea:focus {
  outline: 2px solid rgba(99,102,241,.45);
  border-color: rgba(99,102,241,.45);
}
</style>