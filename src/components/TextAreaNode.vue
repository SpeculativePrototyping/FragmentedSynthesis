<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import type { NodeProps } from '@vue-flow/core'
import { enqueueLlmJob } from '../api/llmQueue'

interface TextNodeData {
  value?: string
  label?: string
  placeholder?: string
}


const props = defineProps<NodeProps<TextNodeData>>()
const { updateNodeData, nodes, edges } = useVueFlow()
const isCompact = ref(false)
const text = ref<string>(String(props.data?.value ?? ''))
const summary = ref("")


const NODE_PROMPT = `You are a concise academic assistant. Summarize the user's text in 1 extremely short sentence.
Output only LaTeX-safe prose (no environments), suitable for inclusion in a paragraph.
Respond strictly with JSON containing a single string property named 'summary'.`

const RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'summary_response',
    schema: {
      type: 'object',
      properties: { summary: { type: 'string' } },
      required: ['summary'],
      additionalProperties: false,
    },
  },
} as const


let requestToken = 0;

async function generateSummary() {
  const txt = text.value.trim()
  if (!txt) {
    summary.value = ''
    return
  }

  const token = ++requestToken
  summary.value = ''

  try {
    const result = await enqueueLlmJob({
      sys: NODE_PROMPT,
      user: txt,
      responseFormat: RESPONSE_FORMAT,
      onStart: () => {},
    })

    if (token !== requestToken) return

    const msg = result.message || ''
    const parsed = (() => {
      try { return JSON.parse(msg) } catch { return null }
    })()

    summary.value = parsed?.summary?.trim() ?? msg.trim()
  } catch {
    summary.value = ''
  }
}

// --- Watchers ---
watch(isCompact, v => {
  if (v) generateSummary()
})

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
  <div class="text-node doc-node node-wrapper" >

    <div class="node-hover-toggle">
      <label class="toggle-switch" title="Shrinks the node and shows a short summary of your input for better visibility.">
        <input type="checkbox" v-model="isCompact"/>
        <span class="slider"></span>
      </label>
      <span
          class="toggle-label"
          title="Shrinks the node and shows a short summary of your input for better visibility.">
            TLDR
          </span>
    </div>

    <header class="doc-node__header">
      <strong>{{ props.data?.label ?? 'Text' }}</strong>
    </header>

    <section class="doc-node__body">
      <textarea
          v-if="!isCompact"
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

      <div v-else class="compact-summary">
        {{ summary }}
      </div>

    </section>

    <Handle id="output" type="source" :position="Position.Right" />
  </div>
</template>

<style scoped>
.text-node { overflow: visible; }

.node-wrapper {
  position: relative;
}

.doc-node__header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.text-node__textarea {
  min-width: 400px;
  min-height: 240px;
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

.compact-summary {
  width: 400px;
  max-height: 240px;
  padding: 10px 12px;
  border: 1px solid rgba(15,23,42,.15);
  border-radius: 10px;
  background: #fff;
  font: inherit;
  font-size: x-small;
  line-height: 1.00;
  overflow: auto;
}

.node-hover-toggle {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}

.node-wrapper:hover .node-hover-toggle {
  opacity: 1;
  pointer-events: auto;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 28px;
  height: 16px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-switch .slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  border-radius: 12px;
  transition: 0.2s;
}

.toggle-switch .slider::before {
  content: "";
  position: absolute;
  height: 12px;
  width: 12px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  border-radius: 50%;
  transition: 0.2s;
}

.toggle-switch input:checked + .slider {
  background-color: #22ff00;
}

.toggle-switch input:checked + .slider::before {
  transform: translateX(12px);
}

.toggle-label {
  font-size: 0.75rem;
  color: #000;
}

</style>