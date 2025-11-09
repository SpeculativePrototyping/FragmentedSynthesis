<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import type { NodeProps } from '@vue-flow/core'

interface TextViewNodeData {
  value?: string
  label?: string
  placeholder?: string
}

const props = defineProps<NodeProps<TextViewNodeData>>()
const { edges, nodes } = useVueFlow()

const heading = computed(() => props.data?.label ?? 'Text Preview')
const placeholder = computed(() => props.data?.placeholder ?? 'Waiting for input…')

const incomingEdges = computed(() => edges.value.filter((edge) => edge.target === props.id))

const sourceText = computed(() => {
  const first = incomingEdges.value[0]
  if (!first) {
    return ''
  }

  const sourceNode = nodes.value.find((node) => node.id === first.source)
  const payload = sourceNode?.data as Record<string, unknown> | undefined
  if (!payload) {
    return ''
  }

  const raw = (payload.value ?? payload.label ?? '') as string
  return typeof raw === 'string' ? raw : ''
})

const displayText = computed(() => {
  if (sourceText.value) {
    return sourceText.value
  }

  const fallback = props.data?.value
  if (fallback === undefined || fallback === null) {
    return ''
  }

  return String(fallback)
})
</script>

<template>
  <div class="text-view-node doc-node">
    <header class="doc-node__header">
      <strong>{{ heading }}</strong>
    </header>

    <section class="doc-node__body text-view-node__body">
      <textarea
        class="text-view-node__textarea"
        @wheel.stop
        :value="displayText"
        readonly
        spellcheck="false"
        :placeholder="placeholder"
        aria-label="Text preview"
      />
    </section>

    <Handle id="input" type="target" :position="Position.Left" />
  </div>
</template>

<style scoped>
.text-view-node {
  overflow: visible;
}

.text-view-node__body {
  position: relative;
}

.text-view-node__textarea {
  min-width:400px;
  min-height: 240px;
  padding: 10px 12px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 10px;
  background-color: #f8fafc;
  color: #0f172a;
  font: inherit;
  line-height: 1.5;
  resize: both;
  cursor: default;
}

.text-view-node__textarea:focus {
  outline: none;
}
</style>
