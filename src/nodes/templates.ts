import type { Node } from '@vue-flow/core'

//describes the structure of a node template that can be dragged from the control pabel
//every node needs: an entry in nodeTemplates, an accompanying import, and an added template in app.vue
export interface NodeTemplate {

  type: NonNullable<Node['type']>
  label: string
  category: 'text' | 'llm' | 'utility'
  data?: Node['data']

}

// Nodes in the drag and drop menu appear in the same order they do here:

export const nodeTemplates: NodeTemplate[] = [
  {
    type: 'textArea',       // tells vueflow what component to load
    label: 'TextArea Node', // readable label for what the node is called in the drag and drop menu
    category: 'text',
    data: {
      label: 'Text Area',   // label the actual node in the UI gets
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
    category: 'text',
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
]

//function to help find the right component according to the type of a node
export function findNodeTemplate(type: string): NodeTemplate | undefined {
  return nodeTemplates.find((template) => template.type === type)
}
