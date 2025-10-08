<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Node } from '@vue-flow/core'
import { Panel, useVueFlow } from '@vue-flow/core'
import Icon from './Icon.vue'
import { findNodeTemplate, nodeTemplates } from './nodes/templates'

const flowKey = 'vue-flow--save-restore'

// Grab reactive helpers from Vue Flow so we can inspect and mutate the graph.
const { nodes, addNodes, dimensions, toObject, fromObject } = useVueFlow()

// Keep the list of templates reactive so the select updates if you edit nodeTemplates.
const availableTemplates = computed(() => nodeTemplates)
// Remember the template the user last chose; default to the first entry.
const selectedNodeType = ref(availableTemplates.value[0]?.type ?? 'default')

/**
 * Save the current graph layout into localStorage.
 * Vue Flow's `toObject()` serialises nodes, edges, and viewport for us.
 */
function onSave(): void {
  localStorage.setItem(flowKey, JSON.stringify(toObject()))
}

/**
 * Load a previously saved graph from localStorage and hand it back to Vue Flow.
 * We guard against missing data so the button stays safe to click anytime.
 */
function onRestore(): void {
  const savedFlow = localStorage.getItem(flowKey)

  if (savedFlow) {
    fromObject(JSON.parse(savedFlow))
  }
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
      

      
        <button title="save graph" @click="onSave">
          <Icon name="save" />
        </button>
        <button title="restore graph" @click="onRestore">
          <Icon name="restore" />
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
/* 
.add-controls {
  align-items: center;
  display: flex;
  gap: 0.5rem;
}

.add-controls select {
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 6px;
  padding: 0.25rem 0.5rem;
}

.add-button {
  align-items: center;
  background-color: #ffffff;
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

.add-button:hover {
  background-color: rgba(15, 23, 42, 0.08);
  box-shadow: 0 2px 4px rgba(15, 23, 42, 0.12);
} */

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
</style>
