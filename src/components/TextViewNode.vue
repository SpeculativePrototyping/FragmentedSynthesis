<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import type { NodeProps } from '@vue-flow/core'
import {NodeToolbar} from "@vue-flow/node-toolbar";
import '../styles/NodeDesign.css'


interface TextViewNodeData {
  value?: string
  label?: string
  placeholder?: string
  width?: number
  height?: number
}

const props = defineProps<NodeProps<TextViewNodeData>>()
const { edges, nodes, setNodes, removeNodes } = useVueFlow()

const heading = computed(() => props.data?.label ?? '')
const placeholder = computed(() => props.data?.placeholder ?? 'Waiting for input…')

// --- Ref auf den gesamten Node-Container ---
const nodeRef = ref<HTMLDivElement | null>(null)
const currentWidth = ref(0)
const currentHeight = ref(0)

// Alle eingehenden Edges
const incomingEdges = computed(() =>
    edges.value.filter((edge) => edge.target === props.id)
)

// Funktion zum Aktualisieren der Node-Größe
function updateSize() {
  if (nodeRef.value) {
    currentWidth.value = nodeRef.value.offsetWidth
    currentHeight.value = nodeRef.value.offsetHeight
  }
}

// ResizeObserver einrichten
let resizeObserver: ResizeObserver | null = null
onMounted(() => {
  if (nodeRef.value) {
    resizeObserver = new ResizeObserver(() => {
      updateSize()
      saveSizeToNode() // Größe speichern
    })
    resizeObserver.observe(nodeRef.value)
    updateSize()
    saveSizeToNode() // initial speichern
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
})

// Anzeige-Text zusammenbauen (inkl. Node-Größe)
const displayText = computed(() => {
  return incomingEdges.value
      .map((edge) => {
        const sourceNode = nodes.value.find((n) => n.id === edge.source)
        if (!sourceNode?.data) return `--- from ${edge.source} ---\n(no data)\n`

        const payload = sourceNode.data as Record<string, unknown>
        const parts: string[] = []

        if (payload.label) parts.push(`Label: ${payload.label}`)
        if (payload.value) parts.push(`Value: ${payload.value}`)
        if (payload.latexLabel) parts.push(`LaTeX: ${payload.latexLabel}`)
        if (payload.latex) parts.push(`Raw LaTeX:\n${payload.latex}`)
        if (payload.refLabel) parts.push(`RefLabel: ${payload.refLabel}`)
        if (payload.citations) parts.push(`Citations: ${(payload.citations as string[]).join(', ')}`)
        if (payload.figures) parts.push(`Figures: ${(payload.figures as string[]).join(', ')}`)
        if (payload.imageName) parts.push(`Image Name: ${payload.imageName}`)
        if (payload.image) parts.push(`Image Base64: ${payload.image}`)
        if (payload.bibliography) parts.push(
            (payload.bibliography as any[]).map((e,i)=>`${i+1}. ${e.title ?? '(no title)'}`).join('\n')
        )

        return `--- from ${sourceNode.id} ---\n${parts.join('\n')}`
      })
      .join('\n\n') + `\n\n[Node Size: ${currentWidth.value}px x ${currentHeight.value}px]`
})

function saveSizeToNode() {
  setNodes((nds) =>
      nds.map((n) =>
          n.id === props.id
              ? {
                ...n,
                data: {
                  ...n.data,
                  width: currentWidth.value,
                  height: currentHeight.value,
                },
              }
              : n
      )
  )
}

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
  <div class="text-view-node doc-node" ref="nodeRef">
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
          aria-label="Debug Node output"
      />
    </section>

    <Handle id="input" type="target" :position="Position.Left" />
  </div>
</template>

<style scoped>


.text-view-node__body {
  position: relative;
}

.text-view-node__textarea {
  width: 260px;
  height: 180px;
  min-width: 260px;
  min-height: 180px;

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
