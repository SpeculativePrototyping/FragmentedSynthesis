<script setup lang="ts">
import { computed, ref, watch} from 'vue'
import type { Node } from '@vue-flow/core'
import { Panel, useVueFlow } from '@vue-flow/core'
import Icon from './Icon.vue'
import { findNodeTemplate, nodeTemplates } from './nodes/templates'

const flowKey = 'vue-flow--save-restore'

// Grab reactive helpers from Vue Flow so we can inspect and mutate the graph and remove edges
const { nodes, edges, setNodes, setEdges, addNodes, dimensions, toObject, fromObject} = useVueFlow()

// Keep the list of templates reactive so the select updates if you edit nodeTemplates.
const availableTemplates = computed(() => nodeTemplates)
// Remember the template the user last chose; default to the first entry.
const selectedNodeType = ref(availableTemplates.value[0]?.type ?? 'default')


//function do delete one or multiple selected edges
function onDeleteSelectedEdges() {
  const remainingEdges = edges.value.filter(edge => !edge.selected)
  setEdges(remainingEdges)
}

//animated edges
watch(edges, (newEdges) => {
  newEdges.forEach(edge => {
    if (edge.animated === undefined) edge.animated = true
    if (!edge.style) edge.style = {}
    if (!edge.markerEnd) edge.markerEnd = { type: 'arrowclosed', color: '#000000' }
    else {
    }
  })
}, { deep: true, immediate: true })


/**
 * Save the current graph layout into localStorage.
 * Vue Flow's `toObject()` serialises nodes, edges, and viewport for us.
 */

//save and load to and from file

// save to json
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

// restore from JSON
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

/**
 * Spawn a new node using whichever template is active in the dropdown.
 * We randomise the spawn position to give the node some breathing room.
 */
function onAdd(): void {
  const id = nodes.value.length + 1
  const template = findNodeTemplate(selectedNodeType.value) ?? findNodeTemplate('default')

  const width = dimensions.value?.width ?? 0
  const height = dimensions.value?.height ?? 0
  const baseLabel = template?.label ?? `Node ${id}`

  // Copy template data so the original definition stays unchanged.
  const data: Node['data'] =
    template?.data && typeof template.data === 'object'
      ? { ...template.data }
      : { label: baseLabel }

  // Guarantee that the node shows a label if the template forgot to set one.
  if (data && typeof data === 'object' && !('label' in data)) {
    ;(data as Record<string, unknown>).label = baseLabel
  }

  // Build the node payload expected by Vue Flow.
  const newNode: Node = {
    id: `${template?.type ?? 'node'}-${id}`,
    type: template?.type,
    position: {
      x: Math.random() * width,
      y: Math.random() * height,
    },
    data,
    dragHandle: '.doc-node__header' //Prevents the node from moving around while resizing
  }

  addNodes([newNode])
}

</script>

<template>
  <Panel position="top-left">
    <div class="panel-content">

         <label class="sr-only" for="node-type-select">Node type</label>
          <select id="node-type-select" v-model="selectedNodeType">
            <option v-for="template in availableTemplates" :key="template.type" :value="template.type">
             {{ template.label }}
           </option>
          </select>
         <div class="buttons">
          <button class="add-button" title="add node" @click="onAdd">
            <Icon name="add" />
          </button>
           <button title="delete selected edges" @click="onDeleteSelectedEdges">
             <Icon name="trash" />
           </button>
          <button title="save graph as file" @click="onSaveToFile">
            <Icon name="save" />
          </button>
          <button title="load graph from file" class="upload-label">
            <Icon name="upload" />
            <input type="file" accept=".json" @click="onRestoreFromFile" />
          </button>
       </div>
     </div>
   </Panel>
</template>

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

</style>
