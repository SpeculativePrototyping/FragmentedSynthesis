<script setup lang="ts">
import type { Node } from '@vue-flow/core'
import { Panel, useVueFlow } from '@vue-flow/core'
import Icon from './Icon.vue'

const flowKey = 'vue-flow--save-restore'

const { nodes, addNodes, dimensions, toObject, fromObject } = useVueFlow()

function onSave() {
  localStorage.setItem(flowKey, JSON.stringify(toObject()))
}

function onRestore() {
  const savedFlow = localStorage.getItem(flowKey)

  if (savedFlow) {
    fromObject(JSON.parse(savedFlow))
  }
}

function onAdd() {
  const id = nodes.value.length + 1

  const newNode: Node = {
    id: `random_node-${id}`,
    position: {
      x: Math.random() * dimensions.value.width,
      y: Math.random() * dimensions.value.height,
    },
    data: { label: `Node ${id}` },
  }

  addNodes([newNode])
}
</script>

<template>
  <Panel position="top-right">
    <div class="buttons">
      <button title="save graph" @click="onSave">
        <Icon name="save" />
      </button>
      <button title="restore graph" @click="onRestore">
        <Icon name="restore" />
      </button>
      <button title="add random node" @click="onAdd">
        <Icon name="add" />
      </button>
    </div>
  </Panel>
</template>
