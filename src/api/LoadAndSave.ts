import { inject, nextTick } from 'vue'
import type { Ref } from 'vue'
import { useVueFlow } from '@vue-flow/core'
import type { BibEntry } from '@/App.vue'

export function useLoadAndSave() {
    const { toObject, fromObject, setNodes, setEdges } = useVueFlow()

    const bibliography = inject<Ref<BibEntry[]>>('bibliography')!
    const TLDR = inject<Ref<boolean>>('TLDR')!
    const templates = inject<Ref<any[]>>('styleTemplates')!
    const setTemplates = inject<(list: any[]) => void>('setStyleTemplates')
    const imageCache = inject<Ref<Record<string, string>>>('imageCache')
    const snapshots = inject<Ref<any[]>>('snapshots')

    /* ---------------- SAVE ---------------- */

    async function saveToFile() {
        const exportData = JSON.parse(JSON.stringify(toObject()))

        // images reinpatchen
        exportData.nodes.forEach((node: any) => {
            if (node.data?.imageName && imageCache?.value[node.data.imageName]) {
                node.data.image = imageCache.value[node.data.imageName]
            }
        })

        exportData.bibliography = bibliography.value
        exportData.TLDR = TLDR.value
        exportData.templates = templates.value
        exportData.snapshots = snapshots?.value ?? []

        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json',
        })

        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'graph.json'
        a.click()
        URL.revokeObjectURL(url)
    }

    /* ---------------- LOAD ---------------- */

    async function restoreFromFile(event: Event) {
        const input = event.target as HTMLInputElement
        const file = input.files?.[0]
        if (!file) return

        const reader = new FileReader()

        reader.onload = async () => {
            try {
                const data = JSON.parse(reader.result as string)

                // 1️⃣ Reset
                setNodes([])
                setEdges([])
                await nextTick()

                // 2️⃣ Images vorab restaurieren (wichtig)
                data.nodes?.forEach((node: any) => {
                    if (node.data?.image && node.data.imageName && imageCache) {
                        imageCache.value[node.data.imageName] = node.data.image
                        node.data.image = undefined
                    }
                })

                // 3️⃣ Daten, die KEINE Watcher-Kaskaden auslösen
                if (data.bibliography) bibliography.value = data.bibliography
                if (data.templates && setTemplates) setTemplates(data.templates)
                if (data.snapshots && snapshots) snapshots.value = data.snapshots

                // 4️⃣ Graph laden
                fromObject(data)

                // 5️⃣ WICHTIG: warten bis Nodes wirklich existieren
                await nextTick()

                // 6️⃣ ERST JETZT globale Modi
                if (typeof data.TLDR === 'boolean') {
                    TLDR.value = data.TLDR
                }

            } catch (err) {
                console.error('Restore failed', err)
            }
        }

        reader.readAsText(file)
    }


    return {
        saveToFile,
        restoreFromFile,
    }
}
