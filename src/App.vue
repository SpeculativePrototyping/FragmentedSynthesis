<script setup lang="ts">
import { ref } from 'vue'
import {type Node, type Edge, type Connection, useVueFlow} from '@vue-flow/core'
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
import GrammarNode from './components/GrammarNode.vue'
import StickyNote from "@/components/StickyNote.vue";
import {MiniMap} from "@vue-flow/minimap";

const nodes = ref<Node[]>([])
const edges = ref<Edge[]>([])

/**
 * Vue Flow emits a `connect` event whenever you draw a new edge in the UI.
 * We merge the incoming connection into our edge list so it sticks around.
 */
function onConnect(connection: Connection) {
  edges.value = addEdge(connection, edges.value) as Edge[]
}

</script>


<template>
  <div style="width: 100%; height: 100vh">
    <VueFlow
        v-model:nodes="nodes"
        v-model:edges="edges"
        @connect="onConnect"
    >
      <SaveRestoreControls />

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
      <template #node-grammar="grammarProps">
        <GrammarNode v-bind="grammarProps" />
      </template>
      <template #node-StickyNote="stickyNoteProps">
        <StickyNote v-bind="stickyNoteProps" />
      </template>

      <Background />

      <!-- MiniMap -->
      <MiniMap
          nodeStrokeColor="#000"
          nodeColor="#fff"
          zoomable
          pannable
      />
    </VueFlow>
  </div>
</template>


<style>
@import './main.css';

/* import the necessary styles for Vue Flow to work */
@import '@vue-flow/core/dist/style.css';

/* import the default theme, this is optional but generally recommended */
@import '@vue-flow/core/dist/theme-default.css';

/* import default minimap theme */
@import '@vue-flow/minimap/dist/style.css';
</style>
