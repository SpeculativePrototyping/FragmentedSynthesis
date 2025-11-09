<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import type { NodeProps } from '@vue-flow/core'

interface ReferenceTrackerData {
  label?: string
}

const props = defineProps<NodeProps<ReferenceTrackerData>>()
const { nodes, edges } = useVueFlow()


const allCitations = computed(() => {
  const sources: string[] = []

  const incomingEdges = edges.value.filter(edge => edge.target === props.id)

  incomingEdges.forEach(edge => {
    const sourceNode = nodes.value.find(n => n.id === edge.source)
    if (sourceNode?.type === 'textArea' && sourceNode.data?.citations) {
      sources.push(...sourceNode.data.citations)
    }
  })

  return Array.from(new Set(sources))
})
</script>

<template>
  <div class="text-node doc-node node-wrapper">
    <header class="doc-node__header">
      <strong>{{ props.data?.label ?? 'Reference Tracker' }}</strong>
    </header>

    <section class="text-node__body citations-list">
      <div v-if="allCitations.length === 0">No sources yet…</div>
      <ul v-else>
        <li v-for="(c, i) in allCitations" :key="i">{{ i + 1 }}. {{ c }}</li>
      </ul>
    </section>

    <Handle id="input" type="target" :position="Position.Left" />
  </div>
</template>

<style scoped>
.text-node { overflow: visible; }

.node-wrapper {
  position: relative;
}

.doc-node__header {
  font-weight: bold;
  padding: 10px 12px;
  border-radius: 10px 10px 0 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.text-node__body {
  min-width: 400px;
  max-width: 400px;
  min-height: 240px;
  height: 240px;
  padding: 10px 12px;
  border: 1px solid rgba(15,23,42,.15);
  border-radius: 0 0 10px 10px;
  background: #fff;
  overflow-y: auto;
  font-family: inherit;
  font-size: 0.9rem;
  line-height: 1.0;
  resize: both;
}

.citations-list ul {
  padding-left: 20px;
  margin: 0;
  list-style-position: inside;
}

.citations-list li {
  margin-bottom: 12px;
  text-align: left;
}
</style>
