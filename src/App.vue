<script setup lang="ts">
import { ref } from 'vue'
import type { Node, Edge, Connection } from '@vue-flow/core'
import { VueFlow, addEdge } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import SaveRestoreControls from './Controls.vue'
import ConcatNode from './components/ConcatNode.vue'
import TextAreaNode from './components/TextAreaNode.vue'
import TextViewNode from './components/TextViewNode.vue'
import SummaryNode from './components/SummaryNode.vue'
import ComposeNode from './components/ComposeNode.vue'
import DocOutputNode from './components/DocOutputNode.vue'
import EditNode from './components/EditNode.vue'

// Demonstration node list so the canvas is not empty when the app starts.
// Feel free to delete or replace entries as you build your own graph.
const nodes = ref<Node[]>([
  
])

// Simple demo edges just to show how data flows between the starter nodes.
const edges = ref<Edge[]>([
  
])


// I don think the code below works
// ß
/**
 * Vue Flow emits a `connect` event whenever you draw a new edge in the UI.
 * We merge the incoming connection into our edge list so it sticks around.
 */
function onConnect(connection: Connection) {
  edges.value = addEdge(connection, edges.value) as Edge[]
}
</script>

<template>
  <div style="width: 100%; height: 600px">
  

    <VueFlow v-model:nodes="nodes" v-model:edges="edges" @connect="onConnect">
      <SaveRestoreControls />
      <!-- bind your custom node types to components by using slots, slot names are always `node-<type>` -->
     
      <template #node-concat="concatNodeProps">
        <ConcatNode v-bind="concatNodeProps" />
      </template>
      <template #node-textArea="textAreaProps">
        <TextAreaNode v-bind="textAreaProps" />
      </template>
      <template #node-textView="textViewProps">
        <TextViewNode v-bind="textViewProps" />
      </template>
      <template #node-summary="summaryProps">
        <SummaryNode v-bind="summaryProps" />
      </template>
      <template #node-compose="composeProps">
        <ComposeNode v-bind="composeProps" />
      </template>
      <template #node-docOutput="docOutputProps">
        <DocOutputNode v-bind="docOutputProps" />
      </template>
      <template #node-edit="editProps">
        <EditNode v-bind="editProps" />
      </template>

      <!-- bind your custom edge type to a component by using slots, slot names are always `edge-<type>` -->
      

      <Background />
    </VueFlow>
  </div>
</template>



<style>
@import './main.css';

/* import the necessary styles for Vue Flow to work */
@import '@vue-flow/core/dist/style.css';

/* import the default theme, this is optional but generally recommended */
@import '@vue-flow/core/dist/theme-default.css';
</style>
