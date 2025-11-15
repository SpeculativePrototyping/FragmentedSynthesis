<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import type { NodeProps, Edge } from '@vue-flow/core'

interface TextViewNodeData {
  value?: string
  label?: string
  placeholder?: string
}

const props = defineProps<NodeProps<TextViewNodeData>>()
const { edges, nodes } = useVueFlow()

const heading = computed(() => props.data?.label ?? 'Debug Node')
const placeholder = computed(() => props.data?.placeholder ?? 'Waiting for input…')

// Alle eingehenden Edges
const incomingEdges = computed(() =>
    edges.value.filter((edge) => edge.target === props.id)
)

// Hilfsfunktion zum Formatieren von Bibliographien
function formatBibliography(bib: any[]): string {
  return bib
      .map((e, i) => {
        const authors = e.fields?.author?.split(/ and /i).map((a: string) => a.trim()).join('; ') ?? ''
        const year = e.fields?.year ?? 'n.d.'
        const title = e.fields?.title ?? '(no title)'
        return `${i + 1}. ${authors} (${year}). ${title}`
      })
      .join('\n')
}

// Anzeige-Text zusammenbauen
const displayText = computed(() => {
  return incomingEdges.value
      .map((edge) => {
        const sourceNode = nodes.value.find((n) => n.id === edge.source)
        if (!sourceNode?.data) return `--- from ${edge.source} ---\n(no data)\n`

        const payload = sourceNode.data as Record<string, unknown>
        const parts: string[] = []

        // Basisinformationen
        if (payload.label) parts.push(`Label: ${payload.label}`)
        if (payload.value) parts.push(`Value: ${payload.value}`)

        // Figure-spezifische Felder
        if (payload.latexLabel) parts.push(`LaTeX: ${payload.latexLabel}`)
        if (payload.refLabel) parts.push(`RefLabel: ${payload.refLabel}`)
        if (payload.citations) parts.push(`Citations: ${(payload.citations as string[]).join(', ')}`)
        if (payload.imageName) parts.push(`Image Name: ${payload.imageName}`)
        if (payload.image) parts.push(`Image Base64: ${payload.image}`)

        // Bibliographie, falls vorhanden
        if (payload.bibliography) parts.push(formatBibliography(payload.bibliography as any[]))

        return `--- from ${sourceNode.id} ---\n${parts.join('\n')}`
      })
      .join('\n\n')
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
          aria-label="Debug Node output"
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
  width: 260px;
  height: 180px;
  min-width:260px;
  min-height: 180px;
  max-width: 480px;
  max-height: 480px;
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
