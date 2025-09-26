import { Handle, Position, useStore } from '@xyflow/react';

export default function TextOutputNode({ id, data }) {
  // Get all edges and nodes from the store
  const edges = useStore((s) => s.edges);
  const nodes = useStore((s) => s.nodes);

  // Find the first incoming edge to this node's "in" handle
  const incomingEdge = edges.find(
    (ed) => ed.target === id && ed.targetHandle === 'in'
  );
  const incomingText = incomingEdge
    ? (nodes.find((n) => n.id === incomingEdge.source)?.data?.value ?? '')
    : '';

  // Only allow one connection to the "in" handle
  const isValidConnection = (conn) => {
    // Block if any edge already connects to this node's "in" handle
    return !edges.some(
      (ed) => ed.target === id && ed.targetHandle === 'in'
    );
  };

  return (
    <div style={{ padding: 8, border: '1px solid #ccc', borderRadius: 6, background: '#fff' }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{data?.label ?? 'Text Output'}</div>
      <div style={{ minWidth: 180, minHeight: 24, whiteSpace: 'pre-wrap' }}>{incomingText}</div>
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        isValidConnection={isValidConnection}
      />
    </div>
  );
}

export const meta = {
  type: 'TextOutputNode',
  label: 'Text Output', // This will be used as the display name
  initialData: {}
};
