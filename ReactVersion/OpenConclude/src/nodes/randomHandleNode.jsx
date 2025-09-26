import { useCallback, useState } from 'react';
import { Handle, useUpdateNodeInternals, Position } from '@xyflow/react';
 
export default function RandomHandleNode({ id }) {
  const updateNodeInternals = useUpdateNodeInternals();
  const [handleCount, setHandleCount] = useState(0);
  const randomizeHandleCount = useCallback(() => {
    setHandleCount(Math.floor(Math.random() * 10));
    updateNodeInternals(id);
  }, [id, updateNodeInternals]);
 
  return (
    <div style={{ minHeight: 40 + handleCount * 24, position: 'relative', padding: 8, border: '1px solid #ccc', borderRadius: 6, background: '#fff' }}>
      {Array.from({ length: handleCount }).map((_, index) => (
        <Handle
          key={index}
          type="target"
          position={Position.Left}
          id={`handle-${index}`}
          style={{ top: 40 + index * 24 }}
        />
      ))}
 
      <div>
        <button onClick={randomizeHandleCount}>Randomize handle count</button>
        <p>There are {handleCount} handles on this node.</p>
      </div>
    </div>
  );
}