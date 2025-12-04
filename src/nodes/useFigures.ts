import { ref, computed, watch, nextTick, type Ref } from 'vue'

interface ImageCacheEntry {
    base64: string
    refLabel: string
}
type ImageCache = Record<string, ImageCacheEntry>

export function useFigures(
    props: { data: { figures?: string[], value?: string } },
    text: Ref<string>,
    imageCache: Ref<ImageCache>,
    updateNodeData: (id: string, data: any) => void,
    nodeId: string
) {
    const searchFigureQuery = ref('')
    const showFigureSearch = ref(false)

    const filteredFigures = computed(() => {
        const q = searchFigureQuery.value.toLowerCase()
        return Object.entries(imageCache.value)
            .filter(([key, img]) => !q || img.refLabel.toLowerCase().includes(q))
    })

    function addFigureReferenceByKey(imageName: string) {
        const img = imageCache.value[imageName]
        if (!img) return

        const label = img.refLabel
        const insertText = `~\\autoref{${label}}`
        const textarea = document.activeElement as HTMLTextAreaElement
        const start = textarea?.selectionStart ?? text.value.length
        const end = textarea?.selectionEnd ?? text.value.length

        text.value = text.value.slice(0, start) + insertText + text.value.slice(end)
        nextTick(() => {
            if (textarea) {
                textarea.selectionStart = textarea.selectionEnd = start + insertText.length
                textarea.focus()
            }
        })

        const figs = new Set(props.data.figures ?? [])
        figs.add(imageName)
        updateNodeData(nodeId, { ...props.data, figures: [...figs] })
    }

    function removeFigureReference(imageName: string) {
        const img = imageCache.value[imageName]
        if (!img) return
        const label = img.refLabel
        text.value = text.value.replace(new RegExp(`~\\\\autoref\\{${label}\\}`, 'g'), '').replace(/\s{2,}/g, ' ').trim()
        const figs = (props.data.figures ?? []).filter(f => f !== imageName)
        updateNodeData(nodeId, { ...props.data, figures: figs, value: text.value })
    }

    function reinsertFigureReference(key: string) {
        addFigureReferenceByKey(key)
    }

    // Watch text, um figures automatisch zu synchronisieren
    let figureTimer: number | undefined
    watch(text, (currentText) => {
        window.clearTimeout(figureTimer)
        figureTimer = window.setTimeout(() => {
            const found = new Set<string>()
            for (const [imageName, img] of Object.entries(imageCache.value)) {
                if (!img.refLabel) continue
                if (new RegExp(`~\\\\autoref\\{${img.refLabel}\\}`, 'g').test(currentText)) found.add(imageName)
            }
            updateNodeData(nodeId, { ...props.data, figures: [...found] })
        }, 5000)
    })

    return {
        searchFigureQuery,
        showFigureSearch,
        filteredFigures,
        addFigureReferenceByKey,
        removeFigureReference,
        reinsertFigureReference,
    }
}
