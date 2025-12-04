import { ref, computed, watch, nextTick, type Ref } from 'vue'

interface BibEntry {
    id: string
    type: string
    fields: Record<string, string>
}

export function useCitations(
    props: { data: { citations?: string[] } },
    text: Ref<string>,
    bibliography: Ref<BibEntry[]>,
    updateNodeData: (id: string, data: any) => void,
    nodeId: string
) {
    const searchQuery = ref('')
    const showSearch = ref(false)
    const cursorPos = ref<{ start: number; end: number }>({ start: 0, end: 0 })
    const COMPLETE_CITATION_REGEX = /~\\cite\{([^\}]+)\}(?=\s|$)/g

    const invalidCitations = computed(() => {
        if (!props.data?.citations) return new Set<string>()
        const bibKeys = new Set(bibliography.value.map(entry => entry.id))
        return new Set(props.data.citations.filter(key => !bibKeys.has(key)))
    })

    function updateCursorPosition(el?: HTMLTextAreaElement) {
        if (el) {
            cursorPos.value = {
                start: el.selectionStart,
                end: el.selectionEnd,
            }
        }
    }

    function addCitationByKey(key: string) {
        const citationText = `~\\cite{${key}}`
        const { start, end } = cursorPos.value

        if (start == null) {
            text.value += citationText
        } else {
            text.value = text.value.slice(0, start) + citationText + text.value.slice(end)
            nextTick(() => {
                const el = document.activeElement as HTMLTextAreaElement
                if (el) el.selectionStart = el.selectionEnd = start + citationText.length
            })
        }

        const citations = props.data.citations ? [...props.data.citations] : []
        if (!citations.includes(key)) citations.push(key)
        updateNodeData(nodeId, { ...props.data, citations })

        searchQuery.value = ''
        showSearch.value = false
    }

    function removeCitation(key: string) {
        const citations = props.data.citations ? [...props.data.citations] : []
        const newCitations = citations.filter(c => c !== key)
        text.value = text.value.replace(new RegExp(`~\\\\cite\\{${key}\\}`, 'g'), '').replace(/\s{2,}/g, ' ').trim()
        updateNodeData(nodeId, { ...props.data, citations: newCitations, value: text.value })
    }

    function reinsertCitation(key: string) {
        addCitationByKey(key)
    }

    // Debounced watcher für Zitate im Text
    let citationTimer: number | undefined
    watch(text, (currentText) => {
        window.clearTimeout(citationTimer)
        citationTimer = window.setTimeout(() => {
            const foundCitations = new Set<string>()
            const matches = currentText.matchAll(COMPLETE_CITATION_REGEX)
            for (const match of matches) foundCitations.add(match[1].trim())
            updateNodeData(nodeId, { ...props.data, citations: Array.from(foundCitations) })
        }, 5000)
    })

    // Watch bibliography: entferne ungültige Zitate
    watch(bibliography, (newBib) => {
        if (!props.data.citations) return
        const invalid = props.data.citations.filter(key => !newBib.some(e => e.id === key))
        invalid.forEach(key => removeCitation(key))
    }, { deep: true })

    return {
        searchQuery,
        showSearch,
        invalidCitations,
        updateCursorPosition,
        addCitationByKey,
        removeCitation,
        reinsertCitation,
    }
}
