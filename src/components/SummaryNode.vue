<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import type { NodeProps } from '@vue-flow/core'
import { enqueueLlmJob } from '../api/llmQueue'

const NODE_LABEL = 'Summarize'
const LENGTH_OPTIONS = ['1 sentence', '2 sentences', '3 sentences', 'Short paragraph'] as const
const DEFAULT_LENGTH = '1 sentences'
const BASE_PROMPT =
  "You are a concise academic assistant. Summarize the user's text in {length}. Output only LaTeX-safe prose (no environments), suitable for inclusion in a paragraph. Respond strictly with JSON containing a single string property named 'summary'."
const RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'summary_response',
    schema: {
      type: 'object',
      properties: {
        summary: { type: 'string' },
      },
      required: ['summary'],
      additionalProperties: false,
    },
  },
} as const

type SummaryStatus = 'idle' | 'queued' | 'processing' | 'done' | 'error'
type LengthOption = (typeof LENGTH_OPTIONS)[number]

interface SummaryNodeData {
  label?: string
  length?: LengthOption
  value?: string
  status?: SummaryStatus
  error?: string | null
}

const props = defineProps<NodeProps<SummaryNodeData>>()
const { edges, nodes, updateNodeData } = useVueFlow()

const label = computed(() => props.data?.label ?? NODE_LABEL)
const length = ref<LengthOption>((props.data?.length as LengthOption) ?? DEFAULT_LENGTH)
const status = ref<SummaryStatus>((props.data?.status as SummaryStatus) ?? 'idle')
const summary = ref(props.data?.value ?? '')
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

function pushNodeData(patch: Partial<SummaryNodeData>) {
  // Keep Vue Flow store in sync so downstream nodes see the latest values.
  updateNodeData(props.id, { ...(props.data ?? {}), length: length.value, ...patch })
}

function resetState() {
  // Clear the node output and status when there is no text to summarise.
  summary.value = ''
  status.value = 'idle'
  error.value = null
  pushNodeData({ value: '', status: 'idle', error: null })
}

function schedule(force: boolean) {
  // Debounce requests so we only call the LLM once the input stabilises.
  window.clearTimeout(debounceTimer)
  debounceTimer = window.setTimeout(() => {
    void queueSummary(force)
  }, force ? 0 : 200)
}

async function queueSummary(force: boolean) {
  const text = inputText.value.trim()

  if (!text) {
    requestToken += 1
    lastKey = ''
    resetState()
    return
  }

  const key = `${text}:::${length.value}`
  if (!force && key === lastKey && status.value !== 'error') {
    return
  }

  const token = ++requestToken
  lastKey = key
  summary.value = ''
  status.value = 'queued'
  error.value = null
  // Share the queued state with the graph so downstream nodes know to wait.
  pushNodeData({ value: '', status: 'queued', error: null })

  const sys = BASE_PROMPT.replace('{length}', length.value)
  const user = buildUserPrompt(text, length.value)

  try {
    // Enqueue the summarisation request so jobs run sequentially.
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

    const summaryText = extractSummary(result.message, result.response)
    summary.value = summaryText
    status.value = 'done'
    error.value = null
    // Persist the successful result for other nodes.
    pushNodeData({ value: summaryText, status: 'done', error: null })
  } catch (err) {
    if (token !== requestToken) {
      return
    }

    status.value = 'error'
    const message = err instanceof Error ? err.message : String(err)
    error.value = message
    summary.value = ''
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

watch(
  length,
  () => {
    // Persist the new length and re-run immediately for fresh output.
    pushNodeData({ length: length.value })
    schedule(true)
  },
  { immediate: false },
)

function onRetry() {
  // Manual retry bypasses the debounce.
  schedule(true)
}

onBeforeUnmount(() => {
  // Prevent stray timers from firing after the node is removed.
  window.clearTimeout(debounceTimer)
})

function buildUserPrompt(text: string, len: string): string {
  return `Summarize the following text.\n\nDesired length: ${len}.\n\nText:\n${text}`
}

function extractSummary(message: string, response: unknown): string {
  const raw = (message || '').trim()
  if (!raw) return ''

  const cleaned = stripCodeFences(raw)
  const parsed = tryParseJson(cleaned)
  if (parsed && typeof parsed.summary === 'string') {
    return parsed.summary.trim()
  }

  if (parsed && parsed.result && typeof parsed.result.summary === 'string') {
    return parsed.result.summary.trim()
  }

  const choices = (response as any)?.choices?.[0]?.message
  const nested = choices?.parsed?.summary
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

<template>
  <div class="summary-node doc-node">
    <header class="doc-node__header">
      <strong>{{ label }}</strong>
      <span class="doc-node__hint">{{ statusLabel }}</span>
    </header>

    <section class="doc-node__body summary-node__body">
      <label class="summary-node__field">
        <span>Length</span>
        <select v-model="length">
          <option v-for="option in LENGTH_OPTIONS" :key="option" :value="option">
            {{ option }}
          </option>
        </select>
      </label>

      <div class="summary-node__actions">
        <button type="button" class="summary-node__retry" @click="onRetry">Retry</button>
      </div>

      <textarea
        class="summary-node__textarea"
        :value="summary"
        readonly
        aria-label="Summary output"
        :placeholder="status === 'idle' ? 'Summary will appear here…' : ''"
      />

      <p v-if="status === 'error'" class="summary-node__status summary-node__status--error" role="alert">
        {{ error }}
      </p>
      <p v-else-if="status !== 'done'" class="summary-node__status">
        {{ status === 'processing' ? 'Working on it…' : status === 'queued' ? 'Queued…' : '' }}
      </p>
    </section>

    <Handle id="input" type="target" :position="Position.Left" />
    <Handle id="output" type="source" :position="Position.Right" />
  </div>
</template>

<style scoped>
.summary-node__body {
  gap: 10px;
}

.summary-node__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.85rem;
}

.summary-node__field select {
  border: 1px solid rgba(15, 23, 42, 0.2);
  border-radius: 6px;
  padding: 4px 6px;
  font: inherit;
}

.summary-node__actions {
  display: flex;
  justify-content: flex-end;
}

.summary-node__retry {
  border: 1px solid rgba(15, 23, 42, 0.2);
  border-radius: 6px;
  background: white;
  padding: 4px 10px;
  font-size: 0.8rem;
  cursor: pointer;
}

.summary-node__retry:hover {
  background: rgba(99, 102, 241, 0.08);
}

.summary-node__textarea {
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

.summary-node__status {
  color: rgba(15, 23, 42, 0.65);
  font-size: 0.85rem;
  min-height: 1.25rem;
}

.summary-node__status--error {
  color: #dc2626;
}
</style>
