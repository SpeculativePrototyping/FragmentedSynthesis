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
    label: 'TextArea Node',
    data: {
      label: 'Text Area',
    },
  },
  {
    type: 'textView',
    label: 'TextView Node',
    data: {
      label: 'Text View',
      placeholder: 'Waiting for input…',
    },
  },
  {
    type: 'summary',
    label: 'Summary Node',
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
    data: {
      sectionType: 'section',
      title: '',
      json: '',
      value: '',
    },
  },
  {
    type: 'edit',
    label: 'Edit Node',
    data: {
      original: '',
      value: '',
      diff: [],
    },
  },
  {
    type: 'docOutput',
    label: 'Document Output',
    data: {
      json: '',
      value: '',
    },
  },
  {
    type: 'StickyNote',
    label: 'Sticky Note',
    data: {
      label: 'Sticky Note',
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
