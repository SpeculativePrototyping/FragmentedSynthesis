import React from 'react';
import {
  ReactFlow, ReactFlowProvider,
  addEdge, applyEdgeChanges, applyNodeChanges,
  Background, Controls, MiniMap
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { buildRegistry } from './nodeRegistry';

const LLM_API_URL = import.meta.env.VITE_LLM_API_URL || '/api/llm';
const LLM_API_KEY = "lm-studio";
const LLM_MODEL = "deepseek/deepseek-r1-0528-qwen3-8b";
const LLM_TEMPERATURE = 0.2;

// Simple queue for LLM jobs
const llmQueue = [];
let llmBusy = false;

async function runLlmJob(job) {
  try {
    const body = {
      model: job.model || LLM_MODEL,
      temperature: job.temp ?? LLM_TEMPERATURE,
      messages: [
        { role: "system", content: job.sys },
        { role: "user", content: job.user }
      ]
    };
    if (job.responseFormat) body.response_format = job.responseFormat;

    const headers = {
      "Content-Type": "application/json",
    };
    if (LLM_API_KEY) headers["Authorization"] = `Bearer ${LLM_API_KEY}`;

    const resp = await fetch(LLM_API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });
    const payload = await resp.json();
    if (!resp.ok) throw new Error(payload.error?.message || resp.statusText);
    const message = payload.choices?.[0]?.message?.content ?? "";
    job.done(message);
  } catch (ex) {
    job.fail(ex);
  }
}

function enqueueLlmJob(job) {
  llmQueue.push(job);
  processLlmQueue();
}

async function processLlmQueue() {
  if (llmBusy || llmQueue.length === 0) return;
  llmBusy = true;
  while (llmQueue.length) {
    const job = llmQueue.shift();
    await runLlmJob(job);
  }
  llmBusy = false;
}

function Canvas() {
  const { nodeTypes, palette } = React.useMemo(() => buildRegistry(), []);
 
  const [edges, setEdges] = React.useState([]);
  const [nodes, setNodes] = React.useState([
    { id: 'in1', type: 'TextInputNode', position: { x: 100, y: 80 }, data: { label: 'Text Input', value: '' } }
  ]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handler = (job) => enqueueLlmJob(job);
    window.enqueueLlmJob = handler;
    return () => {
      if (window.enqueueLlmJob === handler) {
        delete window.enqueueLlmJob;
      }
    };
  }, []);

  // --- Saving and Loading ---
  // Save to localStorage
  const saveFlow = React.useCallback(() => {
    const data = {
      nodes,
      edges,
    };
    localStorage.setItem('flow-data', JSON.stringify(data));
    alert('Flow saved!');
  }, [nodes, edges]);

  // Load from localStorage
  const loadFlow = React.useCallback(() => {
    const data = localStorage.getItem('flow-data');
    if (data) {
      try {
        const { nodes: loadedNodes, edges: loadedEdges } = JSON.parse(data);
        setNodes(loadedNodes || []);
        setEdges(loadedEdges || []);
      } catch (e) {
        alert('Failed to load flow data.');
      }
    } else {
      alert('No saved flow found.');
    }
  }, []);

  const setNodeData = React.useCallback((id, patch) => {
    setNodes(ns =>
      ns.map(n => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n))
    );
  }, []);

  // inject into each node's data before rendering
  const liveNodes = React.useMemo(
    () => nodes.map(n => ({ ...n, data: { ...n.data, setNodeData } })),
    [nodes, setNodeData]
  );

  // ✅ hold the RF instance once mounted
  const rfRef = React.useRef(null);
  const onInit = React.useCallback((instance) => { rfRef.current = instance; }, []);

  // simple context menu state
  const [menu, setMenu] = React.useState({ open: false, x: 0, y: 0 });
  const openMenu  = (x, y) => setMenu({ open: true, x, y });
  const closeMenu = () => setMenu((s) => ({ ...s, open: false }));

  const onNodesChange = (c) => setNodes((ns) => applyNodeChanges(c, ns));
  const onEdgesChange = (c) => setEdges((es) => applyEdgeChanges(c, es));
  const onConnect    = React.useCallback((params) => {
    setEdges((eds) => {
      // Remove any existing edge to the same target and handle
      const filtered = eds.filter(
        (ed) => !(ed.target === params.target && ed.targetHandle === params.targetHandle)
      );
      return [...filtered, { ...params, id: getId() }];
    });
  }, []);

  const onContextMenu = React.useCallback((e) => {
    const onNode   = !!e.target.closest?.('.react-flow__node');
    const onHandle = !!e.target.closest?.('.react-flow__handle');
    if (onNode || onHandle) return;
    e.preventDefault();
    openMenu(e.clientX, e.clientY);
  }, []);

  // ✅ project screen coords to flow coords via instance
  const addNodeAt = React.useCallback((item, clientX, clientY) => {
    const inst = rfRef.current;
    const flowPos = inst?.project
      ? inst.project({ x: clientX, y: clientY })
      : { x: 0, y: 0 }; // fallback (very early mount)

    const id = `${item.type}-${Math.random().toString(36).slice(2, 8)}`;
    setNodes((ns) => ns.concat([{
      id,
      type: item.type,
      position: flowPos,
      data: { label: item.label, ...(item.initialData ?? {}) },
    }]));
  }, []);

  React.useEffect(() => {
    if (nodes.length === 0 && palette.length) {
      setNodes([{
        id: 'demo',
        type: palette[0].type,
        position: { x: 120, y: 80 },
        data: { label: palette[0].label, ...(palette[0].initialData ?? {}) }
      }]);
    }
  }, [palette, nodes.length]);

  let edgeId = 0;
  function getId() {
    return `e${edgeId++}`;
  }

  return (
    <div style={{ width: '100vw', height: '100vh' }} onContextMenu={onContextMenu} onClick={closeMenu}>
      {/* Save/Load Buttons */}
      <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 1001, display: 'flex', gap: 8 }}>
        <button onClick={saveFlow}>Save</button>
        <button onClick={loadFlow}>Load</button>
      </div>
      <ReactFlow
        nodes={liveNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={onInit}          // ✅ set instance
        fitView
      >
        <Background />
        <MiniMap />
        <Controls />
      </ReactFlow>

      {menu.open && (
        <div
          style={{
            position: 'fixed', top: menu.y, left: menu.x, zIndex: 1000,
            background: '#fff', border: '1px solid #ddd', borderRadius: 6,
            boxShadow: '0 6px 24px rgba(0,0,0,0.12)', minWidth: 220, padding: 4
          }}
          onMouseLeave={closeMenu}
        >
          {palette.map((it) => (
            <div
              key={it.type}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { addNodeAt(it, menu.x, menu.y); closeMenu(); }}
              style={{ padding: '6px 10px', cursor: 'pointer', borderRadius: 4, userSelect: 'none' }}
            >
              {it.label} <span style={{ opacity: 0.6, float: 'right' }}>{it.type}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <Canvas />
    </ReactFlowProvider>
  );
}
