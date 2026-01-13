<script setup lang="ts">
import {computed, onBeforeUnmount, onMounted, type Ref, ref, watch} from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import type { NodeProps } from '@vue-flow/core'
import { enqueueLlmJob } from '../api/llmQueue'
import { grammarPrompts } from '@/nodes/prompts'
import { inject } from 'vue'
import {NodeToolbar} from "@vue-flow/node-toolbar";
import '../styles/NodeDesign.css'


const NODE_LABEL = 'Grammar Check'


type GrammarStatus = 'idle' | 'queued' | 'processing' | 'done' | 'error'

interface GrammarNodeData {
  label?: string
  value?: string
  status?: GrammarStatus
  error?: string | null
  citations?: string[]
  width?: number
  height?: number
}

const props = defineProps<NodeProps<GrammarNodeData>>()
const { edges, nodes, updateNodeData, removeNodes } = useVueFlow()
const language = inject<Ref<'en' | 'de'>>('language')!
const label = computed(() => props.data?.label ?? NODE_LABEL)
const status = ref<GrammarStatus>((props.data?.status as GrammarStatus) ?? 'idle')
const grammar = ref(props.data?.value ?? '')
const error = ref<string | null>(props.data?.error ?? null)
const nodeRef = ref<HTMLElement | null>(null)
let resizeObs: ResizeObserver | null = null
let resizeRaf: number | null = null
const incomingEdges = computed(() => edges.value.filter((edge) => edge.target === props.id))

// TLDR / Compact
const TLDR = inject('TLDR')
const isCompact = ref(false)
watch(TLDR, (val) => {
  if (typeof val === 'boolean') isCompact.value = val
})

function getPrompts() {
  return grammarPrompts[language.value]
}

function readNodeText(nodeId: string): string {
  const sourceNode = nodes.value.find(n => n.id === nodeId)
  if (!sourceNode?.data) return ''
  return (sourceNode.data as GrammarNodeData).value ?? ''
}

function readNodeCitations(nodeId: string): string[] {
  const sourceNode = nodes.value.find(n => n.id === nodeId)
  if (!sourceNode?.data) return []
  return (sourceNode.data as GrammarNodeData).citations ?? []
}


const sourceTexts = computed(() =>
    incomingEdges.value
        .map(edge => readNodeText(edge.source))  // hier weiterhin readNodeText
        .filter(text => Boolean(text))
)

const inputCitations = computed(() =>
    incomingEdges.value.flatMap(edge => readNodeCitations(edge.source))
)

const inputText = computed(() => sourceTexts.value.join('\n\n'))

const statusLabel = computed(() => {
  switch (status.value) {
    case 'queued': return 'Status: queued…'
    case 'processing': return 'Status: processing…'
    case 'done': return 'Status: done'
    case 'error': return 'Status: error'
    default: return 'Status: idle'
  }
})

let debounceTimer: number | undefined
let requestToken = 0

function pushNodeData(patch: Partial<GrammarNodeData>) {
  updateNodeData(props.id, { ...(props.data ?? {}), ...patch })
}

function resetState() {
  grammar.value = ''
  status.value = 'idle'
  error.value = null
  pushNodeData({ value: '', status: 'idle', error: null })
}

// -------------------------
//  LaTeX & Sentence Utilities
// -------------------------

// Patterns für LaTeX-Elemente (einfach erweiterbar)
const LATEX_PATTERNS = [
  /~\\cite\{[^}]+\}/g,       // citations
  /\$[^$]+\$/g,               // inline math
  /\$\$[\s\S]+?\$\$/g,        // block math
  /\\[a-zA-Z]+\{[^}]*\}/g     // generische LaTeX-Kommandos
]

// Zerlegt Text in LaTeX- und Texttokens
function tokenizeLaTeX(text: string) {
  const tokens: { type: 'text' | 'latex'; value: string }[] = []
  let lastIndex = 0
  const combined = new RegExp(LATEX_PATTERNS.map(r => r.source).join('|'), 'g')
  let match
  while ((match = combined.exec(text)) !== null) {
    const before = text.slice(lastIndex, match.index)
    if (before.trim()) tokens.push({ type: 'text', value: before })
    tokens.push({ type: 'latex', value: match[0] })
    lastIndex = combined.lastIndex
  }
  const after = text.slice(lastIndex)
  if (after.trim()) tokens.push({ type: 'text', value: after })
  return tokens
}

// Zerlegt Texttokens in einzelne Sätze
function splitSentences(tokens: { type: 'text' | 'latex'; value: string }[]) {
  const result: { type: 'sentence' | 'latex'; value: string }[] = []

  for (const t of tokens) {
    if (t.type === 'latex') {
      result.push({ type: 'latex', value: t.value }) // explizit 'latex'
    } else {
      const sentences = t.value.split(/(?<=[.?!])\s+/)
      for (const s of sentences) {
        if (s.trim()) result.push({ type: 'sentence', value: s.trim() })
      }
    }
  }

  return result
}


// LLM nur auf Sätze anwenden, LaTeX unverändert lassen
async function correctSentences(
    tokens: { type: 'sentence' | 'latex'; value: string }[]
) {
  const output: { type: 'sentence' | 'latex'; value: string }[] = []
  const { basePrompt, responseFormat } = getPrompts()

  for (const t of tokens) {
    if (t.type === 'sentence') {
      const result = await enqueueLlmJob({
        sys: basePrompt,
        user: t.value,
        responseFormat,
        onStart: () => {}
      })

      let corrected = ''
      try {
        const parsed = JSON.parse(result.message || '{}')
        corrected = parsed.grammar?.trim() ?? t.value
      } catch {
        corrected = t.value
      }

      output.push({ type: 'sentence', value: corrected })
    } else {
      output.push({ type: 'latex', value: t.value })
    }
  }

  return output
}



// Alles wieder zusammenfügen
function rebuildText(tokens: { type: 'sentence' | 'latex'; value: string }[]) {
  return tokens.map(t => t.value).join(' ')
}

// -------------------------
//  Scheduler / Queue
// -------------------------

function schedule(force: boolean) {
  window.clearTimeout(debounceTimer)
  debounceTimer = window.setTimeout(() => {
    void queueGrammar(force)
  }, force ? 0 : 200)
}

async function queueGrammar(force: boolean) {
  const text = inputText.value.trim()
  if (!text) { requestToken++; resetState(); return }

  const token = ++requestToken
  grammar.value = ''
  status.value = 'queued'
  error.value = null
  pushNodeData({ value: '', status: 'queued', error: null, citations: inputCitations.value })

  try {
    const latexTokens = tokenizeLaTeX(text)
    const sentenceTokens = splitSentences(latexTokens)
    const correctedTokens = await correctSentences(sentenceTokens)
    const correctedText = rebuildText(correctedTokens)

    grammar.value = correctedText
    status.value = 'done'
    error.value = null
    pushNodeData({
      value: correctedText,
      status: 'done',
      error: null,
      citations: inputCitations.value // <- hier kommen jetzt die BibTeX-Marker
    })
  } catch (err) {
    status.value = 'error'
    const message = err instanceof Error ? err.message : String(err)
    error.value = message
    grammar.value = ''
    pushNodeData({ value: '', status: 'error', error: message, citations: inputCitations.value })
  }
}

let lastInputText = inputText.value


watch(inputText, (newText) => {
  if (newText !== lastInputText) {
    lastInputText = newText
    schedule(false)
  }
}, { immediate: true })

function onRetry() { schedule(true) }

onBeforeUnmount(() => {
  window.clearTimeout(debounceTimer)

  if (resizeObs && nodeRef.value) {
    resizeObs.unobserve(nodeRef.value)
  }
  resizeObs = null

  if (resizeRaf) cancelAnimationFrame(resizeRaf)
})


onMounted(() => {
  if (!nodeRef.value) return

  resizeObs = new ResizeObserver(entries => {
    const box = entries[0].contentRect
    const width = Math.round(box.width)
    const height = Math.round(box.height)

    // debounce via rAF → vermeidet update loop + jitter
    if (resizeRaf) cancelAnimationFrame(resizeRaf)

    resizeRaf = requestAnimationFrame(() => {
      if (
          props.data?.width === width &&
          props.data?.height === height
      ) return

      updateNodeData(props.id, {
        ...(props.data ?? {}),
        width,
        height,
      })
    })
  })

  resizeObs.observe(nodeRef.value)
})


watch(language, () => {
  if (status.value === 'done') {
    schedule(true) // erzwingt erneute Korrektur in neuer Sprache
  }
})

function deleteNode() {
  removeNodes([props.id])
}

</script>





//HTML


<template>
  <NodeToolbar>
    <div class="toolbar-buttons">
      <button class="delete-node-btn" @click="deleteNode" title="Delete this node">
        🗑️
      </button>

      <button type="button" class="toolbar-mini-btn" @click="onRetry" title="Retry">
        🔁
      </button>

      <label class="mini-toggle-switch" title="Compact view / TLDR">
        <input type="checkbox" v-model="isCompact"/>
        <span class="slider"></span>
      </label>
      <span class="mini-toggle-label">TLDR</span>

    </div>
  </NodeToolbar>
  <div class="grammar-node doc-node" ref="nodeRef">
    <header class="doc-node__header">
      <strong>{{ label }}</strong>
      <span class="doc-node__hint">{{ statusLabel }}</span>
    </header>

    <section class="doc-node__body grammar-node__body" v-if="!isCompact">



      <textarea
          @wheel.stop
          class="grammar-node__textarea"
          :value="grammar"
          readonly
          aria-label="Grammar output"
          :placeholder="status === 'idle' ? 'This node can correct your grammar and spelling. It will retain all of your inserted citations and does not change the word order, add new content or remove any existing content.' : ''"
      />

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
  min-width: 350px;
  min-height: 180px;
  padding: 10px 12px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 10px;
  background-color: #f8fafc;
  color: #0f172a;
  font: inherit;
  line-height: 1.45;
  resize: both;
  box-sizing: border-box;
}

</style>
