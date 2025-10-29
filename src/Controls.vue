<script setup lang="ts">
import { computed, ref, watch} from 'vue'
import type { Node } from '@vue-flow/core'
import { Panel, useVueFlow } from '@vue-flow/core'
import Icon from './Icon.vue'
import { findNodeTemplate, nodeTemplates } from './nodes/templates'
import { applyDagreLayout } from './nodes/layouts'



// Grab reactive helpers from Vue Flow so we can inspect and mutate the graph and remove edges
const { nodes, edges, setNodes, setEdges, addNodes, dimensions, toObject, fromObject} = useVueFlow()
// Keep the list of templates reactive so the select updates if you edit nodeTemplates.
const availableTemplates = computed(() => nodeTemplates)
// Remember the template the user last chose; default to the first entry.
const selectedNodeType = ref(availableTemplates.value[0]?.type ?? 'default')


//dnd for new nodes
function onDragStart(type: string, event: DragEvent) {
  if (!event.dataTransfer) return
  event.dataTransfer.setData('node/type', type)
  event.dataTransfer.effectAllowed = 'move'
}

//test function for blub
function onAutoLayout() {
  const newNodes = applyDagreLayout(nodes.value, edges.value, 'LR')
  setNodes(newNodes)
}

//function to delete selected nodes or edges
function onDeleteSelected() {
  const remainingEdges = edges.value.filter(edge => !edge.selected)
  setEdges(remainingEdges)
  const remainingNodes = nodes.value.filter(node => !node.selected)
  setNodes(remainingNodes)
}

// function to save to json-file
function onSaveToFile(): void {
  const dataStr = JSON.stringify(toObject(), null, 2)
  const blob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = 'graph.json'
  a.click()
  URL.revokeObjectURL(url)
}

// function to restore from json-file
function onRestoreFromFile(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result as string)
      fromObject(data)
    } catch (err) {
      console.error('read error', err)
    }
  }
  reader.readAsText(file)
}

</script>

//HTML

<template>
  <Panel position="top-left">
    <div class="panel-content">

         <label class="sr-only" for="node-type-select">Node type</label>
         <div class="buttons">
           <button title="Delete selected nodes or edges" @click="onDeleteSelected">
             <Icon name="trash" />
           </button>
          <button title="Save graph to file" @click="onSaveToFile">
            <Icon name="save" />
          </button>
          <button title="Load graph from file" class="upload-label">
            <Icon name="upload" />
            <input type="file" accept=".json" @change="onRestoreFromFile" />
          </button>
           <button title="Unchaosify" @click="onAutoLayout">
             <Icon name="wand" />
           </button>
         </div>
      <div class="drag-nodes">
        <div
            v-for="template in availableTemplates"
            :key="template.type"
            class="draggable-node"
            draggable="true"
            @dragstart="onDragStart(template.type, $event)"
        >
          {{ template.label }}
        </div>
      </div>

    </div>
   </Panel>
</template>


//CSS

<style scoped>
.panel-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.buttons {
  display: flex;

  flex-direction: column;
  gap: 0.5rem;
}

.buttons button {
  align-items: center;
  background-color: white;
  color: black;
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 6px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
  cursor: pointer;
  display: inline-flex;
  height: 36px;
  justify-content: center;
  padding: 0.25rem;
  transition: background-color 0.2s ease, box-shadow 0.2s ease;
}

.buttons button:hover {
  background-color: rgba(95, 95, 95, 0.08);
  box-shadow: 0 2px 4px rgba(29, 31, 33, 0.12);
}

.buttons svg,
.add-button svg {
  height: 18px;
  width: 18px;
}

.sr-only {
  border: 0;
  clip: rect(0 0 0 0);
  height: 1px;
  margin: -1px;
  overflow: hidden;
  padding: 0;
  position: absolute;
  width: 1px;
}

.upload-label {
  position: relative;
  align-items: center;
  background-color: white;
  color: black;
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 6px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
  cursor: pointer;
  display: inline-flex;
  height: 36px;
  justify-content: center;
  padding: 0.25rem;
  transition: background-color 0.2s ease, box-shadow 0.2s ease;
}

.upload-label:hover {
  background-color: rgba(95, 95, 95, 0.08);
  box-shadow: 0 2px 4px rgba(29, 31, 33, 0.12);
}

.upload-label input {
  position: absolute;
  left: 0;
  top: 0;
  opacity: 0;
  width: 100%;
  height: 100%;
  pointer-events: all;
}

.drag-nodes {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px 0;
  margin-top: 8px;
}

.draggable-node {
  padding: 6px 8px;
  background-color: #eee;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: grab;
  user-select: none;
  font-size: 0.85rem;
  width: 120px; /* optional: feste Breite für eine "Spalte" */
  text-align: center; /* optional: Text zentrieren */
}

</style>
