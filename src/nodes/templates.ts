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
    label: 'TextInput Node', // readable label for what the node is called in the drag and drop menu
    category: 'text',
    data: {
      value: '',
      label: 'Text Input Node',   // label the actual node in the UI gets
      placeholder: 'This node is for text input. Basically, every node represents a paragraph.' +
          ' You can type, add citations and connect it to other nodes.' +
          ' That can be the Grammar Node, the Summary Node, the Edit Node, the Compose Node, or the TextView Node.',
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
      placeholder: 'This node displays everything that other nodes can output. It helps when you are confused about what goes where.',
    },
  },
  {
    type: 'edit',
    label: 'Edit Node',
    category: 'text',
    data: {
      label: 'Edit Node',
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
    label: 'Paraphrase Node',
    category: 'llm',
    data: {
      label: 'Paraphrase Node',
      length: '1-2 sentences',
      value: 'This is a summary.',
      status: 'idle',
      error: null,
    },
  },
  {
    type: 'grammar',
    label: 'Grammar Checker Node',
    category: 'llm',
    data: {
      label: 'Grammar Checker Node',
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
      label: 'Compose Node',
      title: '',
      json: '',
      value: '',
      level: 1,
    },
  },
  {
    type: 'docOutput',
    label: 'Document Output Node',
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
    label: 'Reference Tracker Node',
    category: 'disabled',
    data: {
      label: 'Reference Tracker Node',
      bibliography: [] as BibEntry[],          // optional default empty, Props aus App.vue überschreiben
      updateBibliography: () => {},           // wird durch Props ersetzt
    },
  },
  {
    type: 'figure',       // Vue Flow Component Type
    label: 'Figure Node',     // Name im Drag & Drop Menü
    category: 'text',         // oder 'utility'
    data: {
      image: '' as string,        // fallback: inline base64 (optional)
      imageName: '' as string,    // fallback: cache key
      latexLabel: '' as string,   // caption/label
      citations: [] as string[]
    }
  },
  {
    type: 'tourGuide',       // Vue Flow Component Type
    label: 'Tour Guide',     // Name im Drag & Drop Menü
    category: 'disabled',     // Utility, weil es nur für die Tour gedacht ist
    data: {
      value: '',
      label: 'Steve',
      placeholder: 'This is your friendly tour guide!',
    },
  },
  {
    type: 'figureTracker',      // VueFlow Component Type
    label: 'Figure Tracker Node', // Name im Drag & Drop Menü
    category: 'disabled',          // Utility Node
    data: {
      label: 'Figure Tracker Node',    // Default Label
      // keine weiteren Props nötig, imageCache wird injectet
    }
  }


]

//function to help find the right component according to the type of a node
export function findNodeTemplate(type: string): NodeTemplate | undefined {
  return nodeTemplates.find((template) => template.type === type)
}
