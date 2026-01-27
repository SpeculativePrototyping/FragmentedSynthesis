import { inject, ref, nextTick } from 'vue'
import html2canvas from 'html2canvas'
import type { Ref } from 'vue'
import type { Node, Edge } from '@vue-flow/core'

export function useSnapshots() {
    // 🔒 inject NUR EINMAL im setup-Kontext
    const snapshots = inject<Ref<any[]>>('snapshots')!
    const nodes = inject<Ref<Node[]>>('nodes')!
    const edges = inject<Ref<Edge[]>>('edges')!
    const bibliography = inject<Ref<any[]>>('bibliography')!
    const TLDR = inject<Ref<boolean>>('TLDR')!
    const templates = inject<Ref<any[]>>('styleTemplates')!
    const imageCache = inject<Ref<Record<string, { base64: string }>>>('imageCache')!

    const snapshotInProgress = inject<Ref<boolean>>('snapshotInProgress')!

    async function createSnapshot() {
        snapshotInProgress.value = true
        await nextTick()
        await new Promise(r => requestAnimationFrame(r))

        const exportData = {
            nodes: JSON.parse(JSON.stringify(nodes.value)),
            edges: JSON.parse(JSON.stringify(edges.value)),
            bibliography: bibliography.value,
            TLDR: TLDR.value,
            templates: templates.value,
        }

        exportData.nodes.forEach((node: any) => {
            if (node.data?.imageName && imageCache.value[node.data.imageName]) {
                node.data.image = imageCache.value[node.data.imageName].base64
            }
        })

        let screenshot: string | undefined
        try {
            const flowEl = document.querySelector('.vue-flow') as HTMLElement
            if (flowEl) {
                const canvas = await html2canvas(flowEl)
                screenshot = canvas.toDataURL('image/png')
            }
        } catch (err) {
            console.warn('Snapshot screenshot failed', err)
        }

        await new Promise(r => setTimeout(r, 120))
        snapshotInProgress.value = false

        snapshots.value.unshift({
            id: crypto.randomUUID(),
            name: new Date().toLocaleString(),
            createdAt: Date.now(),
            data: exportData,
            screenshot,
        })
    }


    function restoreSnapshot(id: string) {
        const snap = snapshots.value.find(s => s.id === id)
        if (!snap) return

        nodes.value = []
        edges.value = []

        nextTick(() => {
            // 🔑 Bilder zuerst in den Cache zurücklegen
            snap.data.nodes?.forEach((node: any) => {
                if (node.data?.image && node.data.imageName) {
                    imageCache.value[node.data.imageName] = {
                        base64: node.data.image,
                        refLabel: node.data.refLabel,
                    }
                    node.data.image = undefined
                }
            })

            nodes.value = snap.data.nodes
            edges.value = snap.data.edges
            templates.value = snap.data.templates
            bibliography.value = snap.data.bibliography

            nextTick(() => {
                TLDR.value = snap.data.TLDR
            })
        })
    }


    function deleteSnapshot(id: string) {
        snapshots.value = snapshots.value.filter(s => s.id !== id)
    }

    async function createAutosaveSnapshot() {
        const MAX_AUTOSAVES = 20

        const exportData = {
            nodes: JSON.parse(JSON.stringify(nodes.value)),
            edges: JSON.parse(JSON.stringify(edges.value)),
            bibliography: bibliography.value,
            TLDR: TLDR.value,
            templates: templates.value,
        }

        exportData.nodes.forEach((node: any) => {
            if (node.data?.imageName && imageCache.value[node.data.imageName]) {
                node.data.image = imageCache.value[node.data.imageName].base64
            }
        })

        let screenshot: string | undefined
        try {
            const flowEl = document.querySelector('.vue-flow') as HTMLElement
            if (flowEl) {
                const canvas = await html2canvas(flowEl)
                screenshot = canvas.toDataURL('image/png')
            }
        } catch {}

        snapshots.value.unshift({
            id: crypto.randomUUID(),
            name: `🕒 Autosave - ${new Date().toLocaleTimeString()}`,
            createdAt: Date.now(),
            data: exportData,
            screenshot,
            isAutoSave: true,
        })

        const autosaves = snapshots.value.filter(s => s.isAutoSave)
        if (autosaves.length > MAX_AUTOSAVES) {
            snapshots.value = snapshots.value.filter(
                s => !autosaves
                    .sort((a, b) => a.createdAt - b.createdAt)
                    .slice(0, autosaves.length - MAX_AUTOSAVES)
                    .some(r => r.id === s.id)
            )
        }
    }

    return {
        createSnapshot,
        restoreSnapshot,
        deleteSnapshot,
        createAutosaveSnapshot,
    }
}
