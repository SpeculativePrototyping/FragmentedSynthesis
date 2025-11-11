import type { Node } from '@vue-flow/core'
import type { BibEntry } from '@/App.vue'   // Pfad anpassen


//describes the structure of a node template that can be dragged from the control pabel
//every node needs: an entry in nodeTemplates, an accompanying import, and an added template in app.vue
export interface NodeTemplate {

  type: NonNullable<Node['type']>
  label: string
  category: 'text' | 'llm' | 'utility' | 'disabled'
  data?: Node['data']

}

// Nodes in the drag and drop menu appear in the same order they do here:

export const nodeTemplates: NodeTemplate[] = [
  {
    type: 'textArea',       // tells vueflow what component to load
    label: 'TextInput Node', // readable label for what the node is called in the drag and drop menu
    category: 'text',
    data: {
      value: '',
      label: 'Text Input',   // label the actual node in the UI gets
      placeholder: '',
      citations: [] as string[],
      status: 'idle',
      error: null,
    },
  },
  {
    type: 'textView',
    label: 'TextView Node',
    category: 'text',
    data: {
      label: 'Text View',
      placeholder: 'This node displays incoming text. Waiting for input…',
    },
  },
  {
    type: 'edit',
    label: 'Edit Node',
    category: 'text',
    data: {
      original: '',
      value: '',
      diff: [],
    },
  },
  {
    type: 'concat',
    label: 'Concat Node',
    category: 'disabled',
    data: {
      label: 'Concat',
      concatenated: '',
    },
  },
  {
    type: 'summary',
    label: 'Summary Node',
    category: 'llm',
    data: {
      label: 'Summarize',
      length: '1-2 sentences',
      value: '',
      status: 'idle',
      error: null,
    },
  },
  {
    type: 'grammar',
    label: 'Grammar Node',
    category: 'llm',
    data: {
      label: 'Grammar Checker',
      value: '',
      status: 'idle',
      error: null,
    },
  },
  {
    type: 'compose',
    label: 'Compose Node',
    category: 'text',
    data: {
      sectionType: 'section',
      title: '',
      json: '',
      value: '',
    },
  },
  {
    type: 'docOutput',
    label: 'Document Output',
    category: 'text',
    data: {
      bibliography: [] as BibEntry[],
      json: '',
      value: '',
    },
  },
  {
    type: 'stickyNote',
    label: 'StickyNote',
    category: 'utility',
    data: {
      label: 'Sticky Note',
    },
  },
  {
    type: 'referenceTracker',
    label: 'Reference Tracker',
    category: 'utility',
    data: {
      label: 'Reference Tracker',
      bibliography: [] as BibEntry[],          // optional default empty, Props aus App.vue überschreiben
      updateBibliography: () => {},           // wird durch Props ersetzt
    },
  }

]

//function to help find the right component according to the type of a node
export function findNodeTemplate(type: string): NodeTemplate | undefined {
  return nodeTemplates.find((template) => template.type === type)
}
