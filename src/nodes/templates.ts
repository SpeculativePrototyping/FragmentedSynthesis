import type { Node } from '@vue-flow/core'

/**
 * Describes a node option that can be spawned from the controls panel.
 * Add a new entry here (and an accompanying import) whenever you create a new node type.
 */
export interface NodeTemplate {
  /** Node type string passed to Vue Flow when the node is created. */
  type: NonNullable<Node['type']>
  /** Friendly name shown in the dropdown so you know which one you are spawning. */
  label: string
  /** Optional data payload merged into the new node. Use this for node-specific settings. */
  data?: Node['data']
}

/**
 * Built-in options that ship with the example.
 * You can add new templates or tweak the existing ones by editing this array.
 */
export const nodeTemplates: NodeTemplate[] = [
  {
    type: 'concat',
    label: 'Concat Node',
    data: {
      label: 'Concat',
      concatenated: '',
    },
  },
  {
    type: 'textArea', // THias is important to find the prod...
    label: 'TextAreaNode',
    data: {
      label: 'Text Area',
    },
  },
  {
    type: 'textView',
    label: 'TextViewNode',
    data: {
      label: 'Text View',
      placeholder: 'Waiting for input…',
    },
  },
]

/**
 * Utility that finds a template by node type.
 * This keeps the lookup logic in one place so the component stays easy to follow.
 */
export function findNodeTemplate(type: string): NodeTemplate | undefined {
  return nodeTemplates.find((template) => template.type === type)
}
