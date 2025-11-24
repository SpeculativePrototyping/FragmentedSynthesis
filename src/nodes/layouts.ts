import type { Node, Edge } from '@vue-flow/core'
// @ts-ignore
import dagre from 'dagre'

const SIZE_BY_TYPE: Record<string, { width: number; height: number }> = {
    textArea:        { width: 650, height: 100 },
    textView:        { width: 300, height: 250 },
    edit:            { width: 250, height: 250 },
    summary:         { width: 220, height: 260 },
    grammar:         { width: 300, height: 220 },
    compose:         { width: 300, height: 300 },
    docOutput:       { width: 600, height: 600 },
    referenceTracker:{ width: 300, height: 500 },
    stickyNote:      { width: 0, height: 0 },
    concat:          { width: 480, height: 140 },
}

function getNodeSize(node: Node) {
    const dataWidth = (node.data as any)?.width
    const dataHeight = (node.data as any)?.height

    return {
        width: dataWidth ?? SIZE_BY_TYPE[node.type ?? '']?.width ?? 500,
        height: dataHeight ?? SIZE_BY_TYPE[node.type ?? '']?.height ?? 120,
    }
}

export function applyDagreLayout(
    nodes: Node[],
    edges: Edge[],
    direction: 'TB' | 'LR' = 'LR'
): Node[] {
    const g = new dagre.graphlib.Graph()
    g.setGraph({
        rankdir: direction ,
        ranksep: 150,
        nodesep: 100,
    })
    g.setDefaultEdgeLabel(() => ({}))

    const layoutNodes = nodes.filter(n => n.type !== 'stickyNote')

    // Nodes mit ihrer tatsächlichen Größe eintragen
    layoutNodes.forEach(node => {
        const size = getNodeSize(node)
        g.setNode(node.id, size)
    })

    // Edges setzen
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

        const size = getNodeSize(node)

        return {
            ...node,
            position: {
                x: pos.x - size.width / 2,
                y: pos.y - size.height / 2,
            },
        }
    })
}
