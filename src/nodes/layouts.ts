import type { Node, Edge } from '@vue-flow/core'
// @ts-ignore
import dagre from 'dagre'

const BASE_WIDTH = 450
const BASE_HEIGHT = 240

export function applyDagreLayout(nodes: Node[], edges: Edge[], direction: 'TB' | 'LR' = 'LR'): Node[] {
    const g = new dagre.graphlib.Graph()
    g.setGraph({ rankdir: direction })
    g.setDefaultEdgeLabel(() => ({}))

    // filter out stickynotes
    const layoutNodes = nodes.filter(node => node.type !== 'stickyNote')

    // set layoutnodes to base size
    layoutNodes.forEach(node => {
        g.setNode(node.id, { width: BASE_WIDTH, height: BASE_HEIGHT })
    })

    edges.forEach(edge => {
        if (layoutNodes.find(n => n.id === edge.source) && layoutNodes.find(n => n.id === edge.target)) {
            g.setEdge(edge.source, edge.target)
        }
    })

    dagre.layout(g)

    return nodes.map(node => {
        if (node.type === 'stickyNote') return node
        const { x, y } = g.node(node.id)
        return {
            ...node,
            position: { x: x - BASE_WIDTH / 2, y: y - BASE_HEIGHT / 2 }
        }
    })
}
