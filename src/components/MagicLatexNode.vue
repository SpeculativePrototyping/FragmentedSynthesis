<script lang="ts" setup>
import { ref, watch, computed, inject, onMounted, onBeforeUnmount } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import type { NodeProps } from '@vue-flow/core'
import { NodeToolbar } from '@vue-flow/node-toolbar'
import type { Ref } from 'vue'
import { enqueueLlmJob } from '../api/llmQueue'
import { magicLatexPrompts } from '@/nodes/prompts'

import '../styles/NodeDesign.css'

type LlmStatus = 'idle' | 'queued' | 'processing' | 'done' | 'error'

interface MagicLatexData {
  latex?: string
  prompt?: string
  structureType?: string
  status?: LlmStatus
  error?: string | null
  width?: number
  height?: number
  label?: string
}

interface MagicLatexProps extends NodeProps<MagicLatexData> {}

const props = defineProps<MagicLatexProps>()
const { updateNodeData, removeNodes } = useVueFlow()

const TLDR = inject<Ref<boolean>>('TLDR')!

const latex = ref(props.data?.latex ?? '')
const prompt = ref(props.data?.prompt ?? '')
const structureType = ref(props.data?.structureType ?? '')
const status = ref<LlmStatus>(props.data?.status ?? 'idle')
const language = inject<Ref<'en' | 'de'>>('language')!
const showPrompt = ref(false)
const isCompact = ref(false)

const nodeRef = ref<HTMLElement | null>(null)

let resizeObs: ResizeObserver | null = null
let resizeRaf: number | null = null

const headerTitle = computed(() => {
  if (isCompact.value) {
    return structureType.value
        ? `∑ ${structureType.value}`
        : '∑ LaTeX'
  }
  return props.data?.label ?? 'Magic LaTeX'
})


function getPrompts() {
  return magicLatexPrompts[language.value]
}

function deleteNode() {
  removeNodes([props.id])
}

function fillTemplate(
    template: string,
    vars: Record<string, string>
) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '')
}

async function onAdd() {
  if (!prompt.value.trim()) return

  status.value = 'queued'

  const {
    systemPrompt,
    userPromptAdd,
    responseFormat,
  } = getPrompts()

  const userMessage = fillTemplate(userPromptAdd, {
    request: prompt.value,
  })

  try {
    status.value = 'processing'

    const result = await enqueueLlmJob({
      sys: systemPrompt,
      user: userMessage,
      responseFormat,
    })

    const parsed = JSON.parse(result.message)

    // 🔹 neuen LaTeX-Block berechnen
    const newLatex = latex.value
        ? `${latex.value}\n\n${parsed.latex}`
        : parsed.latex

    // 🔹 Strukturtyp aus dem NEUEN Block erkennen
    const detectedType = detectStructureType(parsed.latex)

    // 🔹 lokale Refs setzen
    latex.value = newLatex
    structureType.value = detectedType
    status.value = 'done'

    // 🔹 EIN sauberer State-Update
    updateNodeData(props.id, {
      ...props.data,
      latex: newLatex,
      structureType: detectedType,
      status: 'done',
    })
  } catch (e) {
    status.value = 'error'

    updateNodeData(props.id, {
      ...props.data,
      status: 'error',
    })
  }
}








async function onModify() {
  if (!prompt.value.trim() || !latex.value.trim()) return

  status.value = 'queued'

  const {
    systemPrompt,
    userPromptModify,
    responseFormat,
  } = getPrompts()

  const userMessage = fillTemplate(userPromptModify, {
    latex: latex.value,
    request: prompt.value,
  })

  try {
    status.value = 'processing'

    const result = await enqueueLlmJob({
      sys: systemPrompt,
      user: userMessage,
      responseFormat,
    })

    const parsed = JSON.parse(result.message)

    const detectedType = detectStructureType(parsed.latex)

    latex.value = parsed.latex
    structureType.value = detectedType
    status.value = 'done'

    updateNodeData(props.id, {
      ...props.data,
      latex: latex.value,
      structureType: detectedType,
      status: 'done',
    })


    latex.value = parsed.latex
    status.value = 'done'

    updateNodeData(props.id, {
      ...props.data,
      latex: latex.value,
      status: 'done',
    })
  } catch (e) {
    status.value = 'error'
  }




}

function detectStructureType(latex: string): string {
  if (!latex) return ''

  const patterns: [RegExp, string][] = [
    [/\\begin\{table\}/, 'table'],
    [/\\begin\{tabular\}/, 'table'],
    [/\\begin\{figure\}/, 'figure'],
    [/\\begin\{itemize\}/, 'itemize'],
    [/\\begin\{enumerate\}/, 'enumerate'],
    [/\\begin\{equation\}/, 'equation'],
    [/\\begin\{align\}/, 'align'],
    [/\\section\{/, 'section'],
    [/\\subsection\{/, 'subsection'],
  ]

  for (const [regex, type] of patterns) {
    if (regex.test(latex)) return type
  }

  return 'latex'
}



onMounted(() => {
  if (!nodeRef.value) return

  resizeObs = new ResizeObserver(entries => {
    const box = entries[0].contentRect
    const width = Math.round(box.width)
    const height = Math.round(box.height)

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

onBeforeUnmount(() => {
  if (resizeObs && nodeRef.value) {
    resizeObs.unobserve(nodeRef.value)
  }
  resizeObs = null
  if (resizeRaf) cancelAnimationFrame(resizeRaf)
})

watch(TLDR, val => {
  isCompact.value = !!val
})

watch(latex, v => {
  updateNodeData(props.id, { ...props.data, latex: v })
})

watch(prompt, v => {
  updateNodeData(props.id, { ...props.data, prompt: v })
})

watch(latex, (v) => {
  const trimmed = v?.trim() ?? ''

  let detected: string

  if (!trimmed) {
    // 🔹 leer → Default
    detected = 'LaTeX'
  } else {
    // 🔹 automatisch neu erkennen
    detected = detectStructureType(trimmed) || 'LaTeX'
  }

  structureType.value = detected

  updateNodeData(props.id, {
    ...props.data,
    latex: v,
    structureType: detected,
  })
})



</script>

<template>
  <NodeToolbar>
    <div class="toolbar-buttons">
      <button
          class="delete-node-btn"
          title="Delete this node"
          @click="deleteNode"
      >
        🗑️
      </button>

      <button
          class="toolbar-mini-btn"
          title="Magic LaTeX Builder"
          :class="{ active: showPrompt }"
          @click="showPrompt = !showPrompt"
      >
        ∑
      </button>

      <label class="mini-toggle-switch" title="TLDR">
        <input v-model="isCompact" type="checkbox" />
        <span class="slider"></span>
      </label>
      <span class="toggle-label">TLDR</span>
    </div>
  </NodeToolbar>

  <div ref="nodeRef" class="doc-node node-wrapper magic-latex-node">
    <header class="doc-node__header">
      <strong>{{ headerTitle }}</strong>
      <span v-if="!isCompact" class="doc-node__hint">
        Status: {{ status }}
      </span>
    </header>

    <section v-if="!isCompact" class="doc-node__body">
      <!-- Ergebnis / LaTeX -->
      <textarea
          v-model="latex"
          class="text-node__textarea"
          rows="6"
          placeholder="Generated LaTeX structure will appear here…"
          spellcheck="false"
          @wheel.stop
      />

      <!-- Prompt -->
      <textarea
          v-if="showPrompt"
          v-model="prompt"
          class="text-node__textarea prompt-textarea"
          rows="3"
          placeholder="Describe what LaTeX structure you want (e.g. table with 3 columns and 5 rows)…"
          @wheel.stop
      />

      <!-- Actions -->
      <div class="magic-actions">
        <button class="fullsize-btn half" @click="onAdd" v-if="showPrompt">
          Add
        </button>
        <button class="fullsize-btn half" @click="onModify" v-if="showPrompt">
          Modify
        </button>
      </div>

    </section>

    <Handle id="output" type="source" :position="Position.Right" />
  </div>
</template>

<style scoped>

.text-node__textarea {
  min-width: 350px;
  min-height: 180px;
  margin: 0 auto;
  padding: 10px 12px;
  border: 1px solid rgba(15, 23, 42, .15);
  border-radius: 10px;
  background: #fff;
  font: inherit;
  line-height: 1.45;
  resize: both;
  box-sizing: border-box;
}

.text-node__textarea:focus {
  outline: 2px solid rgba(99, 102, 241, .45);
  border-color: rgba(99, 102, 241, .45);
}

.magic-latex-node .prompt-textarea {
  margin-top: 20px;
  width: 100%;
  min-width: 350px;
  min-height: 180px;
  padding: 10px 12px;
  border: 1px solid rgba(15, 23, 42, 0.15);
  border-radius: 10px;
  background-color: #fff;
  font: inherit;
  line-height: 1.45;
  resize: none;
  box-sizing: border-box;

}

.magic-latex-node .prompt-textarea:focus {
  outline: 2px solid rgba(99, 102, 241, .45);
  border-color: rgba(99, 102, 241, .45);
}

.magic-actions {
  display: flex;
  gap: 8px;
  width: 100%;
}

.magic-actions .half {
  width: 50%;
}

</style>
