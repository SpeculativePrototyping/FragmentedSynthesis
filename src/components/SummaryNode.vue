<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, inject, type Ref } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import type { NodeProps } from '@vue-flow/core'
import { enqueueLlmJob } from '../api/llmQueue'

/* ----------------------
   Typen / Interfaces
   ---------------------- */
interface StyleTemplate {
  templateName: string
  tone: string
  sectionLength: number
  emphasizePoints: string
}

type SummaryStatus = 'idle' | 'queued' | 'processing' | 'done' | 'error'

interface SummaryNodeData {
  label?: string
  templateName?: string | null
  value?: string
  status?: SummaryStatus
  error?: string | null
  citations?: string[]
  width?: number
  height?: number
}

/* ----------------------
   props MUST be defined early
   ---------------------- */
const props = defineProps<NodeProps<SummaryNodeData>>()

/* ----------------------
   injects and state
   ---------------------- */
// inject style templates (fallback to empty ref so template rendering is safe)
const styleTemplates = inject<Ref<StyleTemplate[]>>('styleTemplates', ref([]))!

// selected template initialized from node data (props is available)
const selectedTemplate = ref<string | null>(props.data?.templateName ?? null)

const NODE_LABEL = 'Summarize'
const BASE_PROMPT =
    "You are a concise academic assistant. Use the user's preferred style template if provided. Output only LaTeX-safe prose, suitable for inclusion in a paragraph. Respond strictly with JSON containing a single string property named 'paraphrase'."

const RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'paraphrase_response',
    schema: {
      type: 'object',
      properties: {
        paraphrase: { type: 'string' },  // statt summary
      },
      required: ['paraphrase'],
      additionalProperties: false,
    },
  },
} as const


/* ----------------------
   Vue Flow
   ---------------------- */
const { edges, nodes, updateNodeData } = useVueFlow()

const label = computed(() => props.data?.label ?? NODE_LABEL)
const status = ref<SummaryStatus>((props.data?.status as SummaryStatus) ?? 'idle')
const summary = ref(props.data?.value ?? '')
const error = ref<string | null>(props.data?.error ?? null)

const nodeRef = ref<HTMLElement | null>(null)
let resizeObs: ResizeObserver | null = null
let resizeRaf: number | null = null

/* incoming edges */
const incomingEdges = computed(() => edges.value.filter((edge) => edge.target === props.id))

const inputCitations = computed(() =>
    incomingEdges.value.flatMap((edge) => readNodeCitations(edge.source)),
)

function readNodeText(nodeId: string): string {
  const sourceNode = nodes.value.find((node) => node.id === nodeId)
  if (!sourceNode?.data) return ''
  const candidate = sourceNode.data as Record<string, unknown>
  const raw = (candidate.value ?? candidate.label ?? '') as string
  return typeof raw === 'string' ? raw : String(raw ?? '')
}

function readNodeCitations(nodeId: string): string[] {
  const sourceNode = nodes.value.find((node) => node.id === nodeId)
  if (!sourceNode?.data) return []
  return (sourceNode.data as any).citations ?? []
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

/* ----------------------
   queueing / debounce
   ---------------------- */
let debounceTimer: number | undefined
let requestToken = 0
let lastKey = ''

function pushNodeData(patch: Partial<SummaryNodeData>) {
  // Keep Vue Flow store in sync so downstream nodes see the latest values.
  updateNodeData(props.id, { ...(props.data ?? {}), ...patch })
}

function buildBasePrompt(template?: StyleTemplate): string {
  if (!template) {
    return `You are a concise academic assistant. Rewrite the text. Output only LaTeX-safe prose but do not include LaTeX-specific commands. Respond strictly with JSON containing a single string property named 'paraphrase'.`
  }

  let nWords = template.sectionLength
  if (nWords === 0) {
    const exampleText = template.emphasizePoints ?? ''
    nWords = exampleText.trim().split(/\s+/).length
  }

  return `You are a concise academic assistant. Use the user's preferred style template if provided.
Paraphrase the following text and ensure it has at least ${nWords} sentences.
If necessary, expand the content naturally to reach at least ${nWords} sentences.
Output only LaTeX-safe prose suitable for inclusion in a paragraph. Respond strictly with JSON containing a single string property named 'paraphrase'.`
  }


function resetState() {
  summary.value = ''
  status.value = 'idle'
  error.value = null
  pushNodeData({ value: '', status: 'idle', error: null })
}

function schedule(force: boolean) {
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

  const key = `${text}:::${selectedTemplate.value ?? 'none'}`
  if (!force && key === lastKey && status.value !== 'error') {
    return
  }

  const token = ++requestToken
  lastKey = key
  summary.value = ''
  status.value = 'queued'
  error.value = null
  pushNodeData({ value: '', status: 'queued', error: null })

  const tpl = styleTemplates.value.find((t) => t.templateName === selectedTemplate.value)
  const sys = buildBasePrompt(tpl)
  const user = buildUserPrompt(inputText.value)


  try {
    const result = await enqueueLlmJob({
      sys,
      user,
      responseFormat: RESPONSE_FORMAT,
      onStart: () => {
        if (token !== requestToken) return
        status.value = 'processing'
        pushNodeData({ status: 'processing' })
      },
    })

    if (token !== requestToken) return

    const summaryText = extractSummary(result.message, result.response)
    summary.value = summaryText
    status.value = 'done'
    error.value = null
    pushNodeData({ value: summaryText, status: 'done', error: null, citations: inputCitations.value })
  } catch (err) {
    if (token !== requestToken) return
    status.value = 'error'
    const message = err instanceof Error ? err.message : String(err)
    error.value = message
    summary.value = ''
    pushNodeData({ value: '', status: 'error', error: message, citations: inputCitations.value })
  }
}

/* ----------------------
   watchers
   ---------------------- */
watch(
    inputText,
    () => {
      schedule(false)
    },
    { immediate: true },
)

// persist the selected template on the node and retrigger when changed
watch(
    selectedTemplate,
    () => {
      pushNodeData({ templateName: selectedTemplate.value ?? null })
      schedule(true)
    },
    { immediate: false },
)

/* ----------------------
   prompt builder using style template
   ---------------------- */
function countSentences(s: string): number {
  return (s.match(/[^.!?]+[.!?]+/g) || []).length;
}

function buildUserPrompt(text: string): string {
  const tpl = styleTemplates.value.find((t) => t.templateName === selectedTemplate.value)
  let styleInfo = ''

  if (tpl) {
    // Tone immer einfügen
    styleInfo += `Use the following style template precisely:\nTarget Audience: ${tpl.tone}\n`

    // Paragraph length bestimmen
    let nWords = tpl.sectionLength;
    if (nWords === 0) {
      // Wörter im Beispiel zählen
      const exampleText = tpl.emphasizePoints ?? "";
      nWords = countSentences(exampleText);
    }

    styleInfo += `Paraphrase in exactly ${nWords} sentences.\n`
    styleInfo += `Examples:\n${tpl.emphasizePoints}\n\n`
  }

  return `${styleInfo}Paraphrase the following text:\n\n${text}`
}



/* ----------------------
   helpers for parsing LLM output
   ---------------------- */
function extractSummary(message: string, response: unknown): string {
  const raw = (message || '').trim()
  if (!raw) return ''

  const cleaned = stripCodeFences(raw)
  const parsed = tryParseJson(cleaned)
  if (parsed && typeof parsed.paraphrase === 'string') {
    return parsed.paraphrase.trim()
  }

  if (parsed && parsed.result && typeof parsed.result.paraphrase === 'string') {
    return parsed.result.paraphrase.trim()
  }

  const choices = (response as any)?.choices?.[0]?.message
  const nested = choices?.parsed?.paraphrase
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

/* ----------------------
   small public action: onRetry
   ---------------------- */
function onRetry() {
  // Manual retry bypasses the debounce.
  schedule(true)
}

/* ----------------------
   size watcher for node
   ---------------------- */
onMounted(() => {
  if (!nodeRef.value) return

  resizeObs = new ResizeObserver((entries) => {
    const box = entries[0].contentRect
    const width = Math.round(box.width)
    const height = Math.round(box.height)

    if (resizeRaf) cancelAnimationFrame(resizeRaf)

    resizeRaf = requestAnimationFrame(() => {
      if (props.data?.width === width && props.data?.height === height) return

      updateNodeData(props.id, {
        ...(props.data ?? {}),
        width,
        height,
      })
    })
  })

  resizeObs.observe(nodeRef.value)
})

onBeforeUnmount(() => {
  if (resizeObs && nodeRef.value) resizeObs.unobserve(nodeRef.value)
  resizeObs = null
  if (resizeRaf) cancelAnimationFrame(resizeRaf)
  window.clearTimeout(debounceTimer)
})

watch(
    styleTemplates,
    (newTemplates, oldTemplates) => {
      // Prüfen, ob das Template verwendet wird
      const tpl = selectedTemplate.value
      if (!tpl) return

      // Prüfen, ob sich das Template, das diese Node nutzt, geändert hat
      const oldTpl = (oldTemplates as any[]).find(t => t.templateName === tpl)
      const newTpl = (newTemplates as any[]).find(t => t.templateName === tpl)

      // Wenn das Template geändert wurde, automatisch retry
      if (JSON.stringify(oldTpl) !== JSON.stringify(newTpl)) {
        onRetry()
      }
    },
    { deep: true }
)




</script>

<template>
  <div class="summary-node doc-node" ref="nodeRef">
    <header class="doc-node__header">
      <strong>{{ label }}</strong>
      <span class="doc-node__hint">{{ statusLabel }}</span>
    </header>

    <section class="doc-node__body summary-node__body">
      <label class="summary-node__field">
        <span>Style Template</span>
        <select v-model="selectedTemplate">
          <option :value="null">No template / default</option>
          <option v-for="tpl in styleTemplates" :key="tpl.templateName" :value="tpl.templateName">
            {{ tpl.templateName }}
          </option>
        </select>
      </label>

      <div class="summary-node__actions">
        <button type="button" class="summary-node__retry" @click="onRetry">Retry</button>
      </div>

      <textarea
          @wheel.stop
          class="summary-node__textarea"
          :value="summary"
          readonly
          aria-label="Summary output"
          :placeholder="status === 'idle' ? 'This node can paraphrase incoming text for you. Choose a style template to influence tone and length.' : ''"
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
  height: 180px;
  min-width: 260px;
  min-height: 180px;
  max-width: 480px;
  max-height: 480px;
  padding: 10px 12px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 10px;
  background-color: #f8fafc;
  color: #0f172a;
  font: inherit;
  line-height: 1.45;
  resize: both;
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
