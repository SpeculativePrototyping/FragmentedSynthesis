// api/latexParser.ts
import type { Node, Edge } from '@vue-flow/core'

export function parseLatexToNodesAndEdges(latex: string): { nodes: Node[], edges: Edge[] } {
    const nodes: Node[] = []
    const edges: Edge[] = []

    // Regex für Sections/Subsections/Subsubsections
    const sectionRegex = /\\(section|subsection|subsubsection)\{([^}]*)\}/g
    // Regex für Paragraphen
    const paragraphRegex = /\\paragraph\{([^}]*)\}/g

    let idCounter = 0
    const levelMap: Record<string, number> = {
        section: 1,
        subsection: 2,
        subsubsection: 3
    }

    const composeNodes: Node[] = []

    // ComposeNodes erzeugen
    let match: RegExpExecArray | null
    while ((match = sectionRegex.exec(latex)) !== null) {
        const [full, type, title] = match
        const node: Node = {
            id: `compose-${idCounter++}`,
            type: 'compose',
            position: { x: 0, y: 0 },
            data: {
                label: 'Compose Node',
                title,
                level: levelMap[type] || 1,
                json: '',
                value: ''
            },
            dragHandle: '.doc-node__header'
        }
        composeNodes.push(node)
        nodes.push(node)
    }

    // DocOutputNode als Root am Ende erstellen
    const docNode: Node = {
        id: 'doc-output',
        type: 'docOutput',
        position: { x: 0, y: 0 },
        data: { label: 'Document Output Node' },
        dragHandle: '.doc-node__header'
    }
    nodes.push(docNode)

    // Jede ComposeNode mit dem DocOutputNode verbinden
    composeNodes.forEach(composeNode => {
        edges.push({
            id: `e-${composeNode.id}-${docNode.id}`,
            source: composeNode.id,
            target: docNode.id,
            // sourceHandle optional: 'out' (wenn der ComposeNode Output-Handle so heißt)
            // targetHandle **nicht setzen**
        })


    })

    // Paragraph Nodes (noch nicht verbunden)
    while ((match = paragraphRegex.exec(latex)) !== null) {
        const [full, text] = match
        const node: Node = {
            id: `textArea-${idCounter++}`,
            type: 'textArea',
            position: { x: 0, y: 0 },
            data: {
                value: text.trim(),
                label: 'Text Input Node',
                placeholder: 'This node is for text input. Basically, every node represents a paragraph.',
                citations: [] as string[],
                status: 'idle',
                error: null
            }
        }
        nodes.push(node)
    }

    return { nodes, edges }
}
