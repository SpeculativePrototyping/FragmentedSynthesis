import React from 'react';
import { Handle, Position, useStore, useUpdateNodeInternals } from '@xyflow/react';

function computeHandles(edges, nodeId) {
  const nodeEdges = edges.filter((e) => e.target === nodeId);
  const occupied = nodeEdges.map((e) => e.targetHandle);
  let indices = occupied.map((h) => parseInt(h.split('-')[1], 10));
  if (indices.length === 0) indices = [0];
  indices = Array.from(new Set(indices)).sort((a, b) => a - b);

  const handles = [];
  for (let i = 0; i < indices.length; ++i) {
    const idx = indices[i];
    if (idx > 0 && (handles.length === 0 || handles[handles.length - 1] !== `in-${idx - 1}`)) {
      handles.push(`in-${idx - 1}`);
    }
    handles.push(`in-${idx}`);
    handles.push(`in-${idx + 1}`);
  }
  return Array.from(new Set(handles))
    .map(h => parseInt(h.split('-')[1], 10))
    .filter(idx => idx >= 0)
    .sort((a, b) => a - b)
    .map(idx => `in-${idx}`);
}

export default function ConcatNode({ id, data }) {
  const edges = useStore((s) => s.edges);
  const nodes = useStore((s) => s.nodes);
  const inputHandles = computeHandles(edges, id);

  const updateNodeInternals = useUpdateNodeInternals();

  React.useEffect(() => {
    updateNodeInternals(id);
  }, [id, inputHandles.join(','), updateNodeInternals]);

  const handleConnections = inputHandles.map((handleId) =>
    edges.find((ed) => ed.target === id && ed.targetHandle === handleId)
  );

  const incomingTexts = handleConnections.map((edge) =>
    edge ? (nodes.find((n) => n.id === edge.source)?.data?.value ?? '') : ''
  );

  // Concatenate all incoming texts for output
  const concatenated = incomingTexts.filter(Boolean).join(' ');

  // Emit the output value to node data for downstream nodes
  React.useEffect(() => {
    if (data?.setNodeData && data.value !== concatenated) {
      data.setNodeData(id, { value: concatenated });
    }
    // Only run when concatenated changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concatenated]);

  const isValidConnection = (handleId) => (conn) =>
    !edges.some((ed) => ed.target === id && ed.targetHandle === handleId);

  // About 20 characters wide in monospace is ~160px, but let's use 180px for padding
  const boxWidth = 100;

  return (
    <div
      style={{
        padding: 8,
        border: '1px solid #ccc',
        borderRadius: 6,
        background: '#fff',
        minWidth: boxWidth,
        maxWidth: boxWidth,
        position: 'relative',
        boxSizing: 'border-box'
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 6, textAlign: 'center' }}>
        {data?.label ?? 'Concat'}
      </div>
      <div style={{ position: 'relative', minHeight: inputHandles.length * 28 }}>
        {inputHandles.map((handleId, idx) => (
          <div
            key={handleId}
            style={{
              display: 'flex',
              alignItems: 'center',
              height: 28,
              position: 'relative'
            }}
          >
            <Handle
              type="target"
              position={Position.Left}
              id={handleId}
              isValidConnection={isValidConnection(handleId)}
              style={{ top: '50%', transform: 'translateY(-50%) translateX(-150%)' }}
            />
            <span
              style={{
                marginLeft: 16,
                fontSize: 12,
                color: '#888',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: boxWidth - 32,
                display: 'inline-block'
              }}
              title={incomingTexts[idx]}
            >
              {incomingTexts[idx] ? incomingTexts[idx] : <i>empty</i>}
            </span>
          </div>
        ))}
      </div>
      {/* Output handle for the concatenated result */}
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        style={{ top: '50%', transform: 'translateY(-50%) translateX(50%)' }}
      />
    </div>
  );
}

export const meta = {
  type: 'ConcatNode',
  label: 'Concat',
  initialData: {}
};