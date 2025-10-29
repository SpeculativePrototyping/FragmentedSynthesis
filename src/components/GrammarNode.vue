<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import type { NodeProps } from '@vue-flow/core'
import { enqueueLlmJob } from '../api/llmQueue'

const NODE_LABEL = 'Grammar Check'
const BASE_PROMPT = "You are a concise academic assistant." +
                    "Correct the users spell and grammar." +
                    "Output only LaTeX-safe prose (no environments), suitable for inclusion in a paragraph." +
                    "Respond strictly with JSON containing a single string property named 'grammar'."


const RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'grammar_response',
    schema: {
      type: 'object',
      properties: {
        grammar: { type: 'string' },
      },
      required: ['grammar'],
      additionalProperties: false,
    },
  },
} as const

type GrammarStatus = 'idle' | 'queued' | 'processing' | 'done' | 'error'


interface GrammarNodeData {
  label?: string
  value?: string
  status?: GrammarStatus
  error?: string | null
}

const props = defineProps<NodeProps<GrammarNodeData>>()
const { edges, nodes, updateNodeData } = useVueFlow()

const label = computed(() => props.data?.label ?? NODE_LABEL)
const status = ref<GrammarStatus>((props.data?.status as GrammarStatus) ?? 'idle')
const grammar = ref(props.data?.value ?? '')
const error = ref<string | null>(props.data?.error ?? null)

const incomingEdges = computed(() => edges.value.filter((edge) => edge.target === props.id))

function readNodeText(nodeId: string): string {
  const sourceNode = nodes.value.find((node) => node.id === nodeId)
  if (!sourceNode?.data) return ''
  const candidate = sourceNode.data as Record<string, unknown>
  const raw = (candidate.value ?? candidate.label ?? '') as string
  return typeof raw === 'string' ? raw : String(raw ?? '')
}

const sourceTexts = computed(() =>
    incomingEdges.value.map((edge) => readNodeText(edge.source)).filter((text) => Boolean(text)),
)

const inputText = computed(() => sourceTexts.value.join('\n\n'))

const statusLabel = computed(() => {
  switch (status.value) {
    case 'queued':
      return 'Status: queued…'
    case 'processing':
      return 'Status: processing…'
    case 'done':
      return 'Status: done'
    case 'error':
      return 'Status: error'
    default:
      return 'Status: idle'
  }
})

let debounceTimer: number | undefined
let requestToken = 0
let lastKey = ''

function pushNodeData(patch: Partial<GrammarNodeData>) {
  // Keep Vue Flow store in sync so downstream nodes see the latest values.
  updateNodeData(props.id, { ...(props.data ?? {}), ...patch })
}

function resetState() {
  // Clear the node output and status when there is no text to summarise.
  grammar.value = ''
  status.value = 'idle'
  error.value = null
  pushNodeData({ value: '', status: 'idle', error: null })
}

function schedule(force: boolean) {
  // Debounce requests so we only call the LLM once the input stabilises.
  window.clearTimeout(debounceTimer)
  debounceTimer = window.setTimeout(() => {
    void queueGrammar(force)
  }, force ? 0 : 200)
}

async function queueGrammar(force: boolean) {
  const text = inputText.value.trim()

  if (!text) {
    requestToken += 1
    lastKey = ''
    resetState()
    return
  }


  const token = ++requestToken
  grammar.value = ''
  status.value = 'queued'
  error.value = null
  // Share the queued state with the graph so downstream nodes know to wait.
  pushNodeData({ value: '', status: 'queued', error: null })

  const sys = BASE_PROMPT
  const user = text

  try {
    // Enqueue the correction request so jobs run sequentially.
    const result = await enqueueLlmJob({
      sys,
      user,
      responseFormat: RESPONSE_FORMAT,
      onStart: () => {
        if (token !== requestToken) return
        status.value = 'processing'
        // Flag the node as active while the request is in flight.
        pushNodeData({ status: 'processing' })
      },
    })

    if (token !== requestToken) {
      return
    }

    const GrammarText = extractGrammar(result.message, result.response)
    grammar.value = GrammarText
    status.value = 'done'
    error.value = null
    // Persist the successful result for other nodes.
    pushNodeData({ value: GrammarText, status: 'done', error: null })
  } catch (err) {
    if (token !== requestToken) {
      return
    }

    status.value = 'error'
    const message = err instanceof Error ? err.message : String(err)
    error.value = message
    grammar.value = ''
    // Make sure consumers can react to the failure state.
    pushNodeData({ value: '', status: 'error', error: message })
  }
}

watch(
    inputText,
    () => {
      // React to upstream text changes.
      schedule(false)
    },
    { immediate: true },
)


function onRetry() {
  // Manual retry bypasses the debounce.
  schedule(true)
}

onBeforeUnmount(() => {
  // Prevent stray timers from firing after the node is removed.
  window.clearTimeout(debounceTimer)
})


function extractGrammar(message: string, response: unknown): string {
  const raw = (message || '').trim()
  if (!raw) return ''

  const cleaned = stripCodeFences(raw)
  const parsed = tryParseJson(cleaned)
  if (parsed && typeof parsed.grammar === 'string') {
    return parsed.grammar.trim()
  }

  if (parsed && parsed.result && typeof parsed.result.grammar === 'string') {
    return parsed.result.grammar.trim()
  }

  const choices = (response as any)?.choices?.[0]?.message
  const nested = choices?.parsed?.grammar
  if (typeof nested === 'string') {
    return nested.trim()
  }

  return cleaned
}

function tryParseJson(source: string): any {
  try {
    return JSON.parse(source)
  } catch {
    return undefined
  }
}

function stripCodeFences(text: string): string {
  const fenceMatch = text.match(/^```[a-zA-Z0-9]*\n([\s\S]*?)```$/)
  if (fenceMatch && fenceMatch[1]) {
    return fenceMatch[1].trim()
  }
  return text
}
</script>



//HTML


<template>
  <div class="grammar-node doc-node">
    <header class="doc-node__header">
      <strong>{{ label }}</strong>
      <span class="doc-node__hint">{{ statusLabel }}</span>
    </header>

    <section class="doc-node__body grammar-node__body">

      <div class="grammar-node__actions">
        <button type="button" class="grammar-node__retry" @click="onRetry">Retry</button>
      </div>

      <textarea
          class="grammar-node__textarea"
          :value="grammar"
          readonly
          aria-label="Grammar output"
          :placeholder="status === 'idle' ? 'Corrected text will appear here…' : ''"
      />

      <p v-if="status === 'error'" class="grammar-node__status grammar-node__status--error" role="alert">
        {{ error }}
      </p>
      <p v-else-if="status !== 'done'" class="grammar-node__status">
        {{ status === 'processing' ? 'Working on it…' : status === 'queued' ? 'Queued…' : '' }}
      </p>
    </section>

    <Handle id="input" type="target" :position="Position.Left" />
    <Handle id="output" type="source" :position="Position.Right" />
  </div>
</template>


//CSS


<style scoped>
.grammar-node__body {
  gap: 10px;
}

.grammar-node__field select {
  border: 1px solid rgba(15, 23, 42, 0.2);
  border-radius: 6px;
  padding: 4px 6px;
  font: inherit;
}

.grammar-node__actions {
  display: flex;
  justify-content: flex-end;
}

.grammar-node__retry {
  border: 1px solid rgba(15, 23, 42, 0.2);
  border-radius: 6px;
  background: white;
  padding: 4px 10px;
  font-size: 0.8rem;
  cursor: pointer;
}

.grammar-node__retry:hover {
  background: rgba(99, 102, 241, 0.08);
}

.grammar-node__textarea {
  width: 260px;
  min-height: 120px;
  padding: 10px 12px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 10px;
  background-color: #f8fafc;
  color: #0f172a;
  font: inherit;
  line-height: 1.45;
  resize: vertical;
}

.grammar-node__status {
  color: rgba(15, 23, 42, 0.65);
  font-size: 0.85rem;
  min-height: 1.25rem;
}

.grammar-node__status--error {
  color: #dc2626;
}
</style>
