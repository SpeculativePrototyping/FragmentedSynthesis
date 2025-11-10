<script setup lang="ts">
import { computed, watch } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import type { NodeProps } from '@vue-flow/core'

interface ReferenceTrackerData {
  label?: string
  allCitations?: { citation: string; count: number }[]
  citationsPerNode?: Record<string, string[]>
}

const props = defineProps<NodeProps<ReferenceTrackerData>>()
const { nodes, edges, updateNodeData } = useVueFlow()

// Map: nodeId -> citations[]
const citationsByNode = computed(() => {
  const map = new Map<string, string[]>()
  const incomingEdges = edges.value.filter(edge => edge.target === props.id)

  incomingEdges.forEach(edge => {
    const sourceNode = nodes.value.find(n => n.id === edge.source)
    if (sourceNode?.type === 'textArea' && sourceNode.data?.citations) {
      // ensure we store a copy (avoid accidental mutation)
      map.set(sourceNode.id, [...(sourceNode.data.citations as string[])])
    }
  })

  return map
})

// combined list without duplicates, with counter
const allCitations = computed(() => {
  const countMap = new Map<string, number>()

  citationsByNode.value.forEach(citations => {
    citations.forEach(c => {
      if (!c) return
      countMap.set(c, (countMap.get(c) ?? 0) + 1)
    })
  })

  return Array.from(countMap.entries()).map(([citation, count]) => ({
    citation,
    count
  }))
})

// export data to node.data so other nodes (docOutputNode) can read it from the graph
watch([allCitations, citationsByNode], () => {
  const payload = {
    ...props.data,
    allCitations: allCitations.value,
    // Object.fromEntries works with Map
    citationsPerNode: Object.fromEntries(citationsByNode.value)
  }

  updateNodeData(props.id, payload)
}, { immediate: true })
</script>

<template>
  <div class="text-node doc-node node-wrapper">
    <header class="doc-node__header">
      <strong>{{ props.data?.label ?? 'Reference Tracker' }}</strong>
    </header>

    <section class="text-node__body citations-list">
      <div v-if="allCitations.length === 0">No sources yet…</div>
      <ul v-else>
        <li v-for="(item, i) in allCitations" :key="i">
          {{ i + 1 }}. {{ item.citation }}
          <span v-if="item.count > 1">({{ item.count }}× cited)</span>
        </li>
      </ul>
    </section>

    <!-- input left, output right -->
    <Handle id="input" type="target" :position="Position.Left" />
    <Handle id="output" type="source" :position="Position.Right" />
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
  line-height: 1.2;
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
  word-break: break-word; /* Zeilenumbruch bei langen Quellen */
}
</style>
