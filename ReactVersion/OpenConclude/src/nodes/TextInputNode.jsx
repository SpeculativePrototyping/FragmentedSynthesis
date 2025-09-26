import { useState } from 'react';
import { Handle, Position } from '@xyflow/react';



export default function TextInputNode({ id, data }) {
  const value = data?.value ?? '';
  const setValue = data?.setNodeData;
  const [localValue, setLocalValue] = useState(value);

  // Sync local state if node data changes externally
  // (optional, only if value can change from outside)
  // useEffect(() => { setLocalValue(value); }, [value]);

  const commitValue = () => {
    if (localValue !== value) {
      setValue?.(id, { value: localValue });
    }
  };

  return (
    <div style={{ padding: 8, border: '1px solid #ccc', borderRadius: 6, background: '#fff' }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{data?.label ?? 'Text Input'}</div>
      <input
        className="nodrag nopan"
        style={{ width: 180 }}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={commitValue}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commitValue();
            e.target.blur();
          }
          e.stopPropagation();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        placeholder="Type here…"
      />
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}
export const meta = {
  type: 'TextInputNode',
  label: 'Text Input', // This will be used as the display name
  initialData: { value: '' }
};