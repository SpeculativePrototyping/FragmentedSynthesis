import React, { useState, useEffect, useRef } from 'react';
import { Handle, Position, useStore } from '@xyflow/react';

const DEFAULT_PROMPT = "You are a concise academic assistant. Summarize the user's text in {length}. Output only LaTeX-safe prose (no environments), suitable for inclusion in a paragraph.";

export default function SummarizeNode({ id, data }) {
  const edges = useStore(s => s.edges);
  const nodes = useStore(s => s.nodes);
  const setNodeData = data?.setNodeData;

  // Find the first incoming edge to this node's "in" handle
  const incomingEdge = edges.find(ed => ed.target === id && ed.targetHandle === 'in');
  const inputText = incomingEdge
    ? (nodes.find(n => n.id === incomingEdge.source)?.data?.value ?? '')
    : '';

  const [prompt, setPrompt] = useState(data?.prompt || DEFAULT_PROMPT);
  const [length, setLength] = useState(data?.length || "1-2 sentences");
  const [status, setStatus] = useState('idle');
  const [preview, setPreview] = useState('');

  // Persist prompt/length
  useEffect(() => { setNodeData?.(id, { prompt, length }); }, [prompt, length, id, setNodeData]);

  // Summarize when input or prompt/length changes
  const lastRequest = useRef({});
  useEffect(() => {
    if (!inputText.trim()) {
      setStatus('idle'); setPreview(''); setNodeData?.(id, { value: '' }); return;
    }
    if (
      lastRequest.current.inputText === inputText &&
      lastRequest.current.prompt === prompt &&
      lastRequest.current.length === length
    ) return;
    lastRequest.current = { inputText, prompt, length };
    setStatus('queued…'); setPreview('');
    const sysPrompt = prompt.replace('{length}', length);
    window.enqueueLlmJob?.({
      user: inputText,
      sys: sysPrompt,
      done: summary => {
        setStatus('done');
        setPreview(summary?.slice(0, 60) + (summary?.length > 60 ? '…' : ''));
        setNodeData?.(id, { value: summary });
      },
      fail: ex => {
        setStatus('error');
        setPreview('error: ' + (ex.message || ex.toString()));
        setNodeData?.(id, { value: '' });
      }
    });
  }, [inputText, prompt, length, id, setNodeData]);

  const isValidConnection = conn =>
    !edges.some(ed => ed.target === id && ed.targetHandle === 'in');

  const boxWidth = 220;

  return (
    <div style={{
      padding: 8, border: '1px solid #ccc', borderRadius: 6, background: '#fff',
      minWidth: boxWidth, maxWidth: boxWidth, position: 'relative', boxSizing: 'border-box'
    }}>
      <div style={{ fontWeight: 600, marginBottom: 6, textAlign: 'center' }}>
        {data?.label ?? 'Summarize'}
      </div>
      <input
        type="text"
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        style={{ width: '100%', fontSize: 12, marginBottom: 4 }}
        placeholder="System prompt (use {length})"
      />
      <select
        value={length}
        onChange={e => setLength(e.target.value)}
        style={{ width: '100%', fontSize: 12, marginBottom: 4 }}
      >
        <option>1 sentence</option>
        <option>2 sentences</option>
        <option>1-2 sentences</option>
        <option>3 sentences</option>
        <option>Short paragraph</option>
      </select>
      <div style={{ display: 'flex', alignItems: 'center', height: 28, position: 'relative' }}>
        <Handle
          type="target"
          position={Position.Left}
          id="in"
          isValidConnection={isValidConnection}
          style={{ top: '50%', transform: 'translateY(-50%)' }}
        />
        <span
          style={{
            marginLeft: 16, fontSize: 12, color: '#888', whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: boxWidth - 32, display: 'inline-block'
          }}
          title={inputText}
        >
          {inputText ? inputText : <i>empty</i>}
        </span>
      </div>
      <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>
        <b>Status:</b> {status}<br />
        <b>Preview:</b> {preview}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        style={{ top: '50%', transform: 'translateY(-50%)' }}
      />
    </div>
  );
}

export const meta = {
  type: 'SummarizeNode',
  label: 'Summarize',
  initialData: { prompt: '', length: '1-2 sentences' }
};

