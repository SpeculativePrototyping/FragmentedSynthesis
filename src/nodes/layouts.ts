import type { Node, Edge } from '@vue-flow/core'
// @ts-ignore
import dagre from 'dagre'

/**
 * Feste Node-Größen nach Node-Type
 * (Kann jederzeit hier angepasst werden)
 */
const SIZE_BY_TYPE: Record<string, { width: number; height: number }> = {
    textArea:        { width: 650, height: 100 },
    textView:        { width: 300, height: 250 },
    edit:            { width: 250, height: 250 },
    summary:         { width: 220, height: 260 },
    grammar:         { width: 300, height: 220 },
    compose:         { width: 300, height: 300 },
    docOutput:       { width: 600, height: 600 },
    referenceTracker:{ width: 300, height: 500 },

    // Sticky notes und concat nodes werden im Layout ignoriert
    stickyNote:      { width: 0, height: 0 },
    concat:          { width: 480, height: 140 },
}

export function applyDagreLayout(
    nodes: Node[],
    edges: Edge[],
    direction: 'TB' | 'LR' = 'LR'
): Node[] {
    const g = new dagre.graphlib.Graph()

    g.setGraph({ rankdir: direction })
    g.setDefaultEdgeLabel(() => ({}))

    // Nur nodes layouten, die nicht sticky sind
    const layoutNodes = nodes.filter(node => node.type !== 'stickyNote')

    layoutNodes.forEach(node => {
        const size = SIZE_BY_TYPE[node.type ?? ''] ?? { width: 500, height: 120 }
        g.setNode(node.id, { width: size.width, height: size.height })
    })

    edges.forEach(edge => {
        if (
            layoutNodes.some(n => n.id === edge.source) &&
            layoutNodes.some(n => n.id === edge.target)
        ) {
            g.setEdge(edge.source, edge.target)
        }
    })

    dagre.layout(g)

    // Neue Positionen zurückgeben
    return nodes.map(node => {
        if (node.type === 'stickyNote') return node
        const pos = g.node(node.id)
        if (!pos) return node

        const size = SIZE_BY_TYPE[node.type ?? ''] ?? { width: 500, height: 120 }

        return {
            ...node,
            position: {
                x: pos.x - size.width / 2,
                y: pos.y - size.height / 2,
            },
        }
    })
}
