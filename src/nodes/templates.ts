import type { Node } from '@vue-flow/core'
import type { BibEntry } from '@/App.vue'   // Pfad anpassen


//describes the structure of a node template that can be dragged from the control panel
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
    label: 'Paragraph', // readable label for what the node is called in the drag and drop menu
    category: 'text',
    data: {
      value: '',
      label: 'Paragraph',   // label the actual node in the UI gets
      placeholder: 'This node is for text input. Basically, every node represents a paragraph.' +
          ' You can type, add citations and connect it to other nodes.' +
          ' That can be the Grammar Node, the Summary Node, the Edit Node, the Compose Node, or the TextView Node.',
      citations: [] as string[],
      status: 'idle',
      error: null,
    },
  },
  {
    type: 'figure',
    label: 'Figure',
    category: 'text',
    data: {
      image: '' as string,
      imageName: '' as string,
      latexLabel: '' as string,
      citations: [] as string[]
    }
  },
  {
    type: 'edit',
    label: 'Edit',
    category: 'llm',
    data: {
      label: 'Edit',
      original: '',
      value: '',
      diff: [],
    },
  },
  {
    type: 'paraphrase',
    label: 'Paraphrase',
    category: 'llm',
    data: {
      label: 'Paraphrase',
      length: '1-2 sentences',
      value: 'This is a summary.',
      status: 'idle',
      error: null,
    },
  },
  {
    type: 'grammar',
    label: 'Grammar',
    category: 'llm',
    data: {
      label: 'Grammar',
      value: '',
      status: 'idle',
      error: null,
    },
  },
  {
    type: 'compose',
    label: 'Compose',
    category: 'text',
    data: {
      label: 'Compose',
      title: '',
      json: '',
      value: '',
      level: 1,
    },
  },
  {
    type: 'docOutput',
    label: 'Document Output',
    category: 'utility',
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
    type: 'textView',
    label: 'Debug',
    category: 'utility',
    data: {
      label: 'Debug',
      placeholder: 'This node displays everything that other nodes can output. It helps when you are confused about what goes where.',
    },
  },
  {
    type: 'tourGuide',
    label: 'Tour Guide',
    category: 'disabled',
    data: {
      value: '',
      label: 'Steve',
      placeholder: 'This is your friendly tour guide!',
    },
  }
]

//function to help find the right component according to the type of a node
export function findNodeTemplate(type: string): NodeTemplate | undefined {
  return nodeTemplates.find((template) => template.type === type)
}
