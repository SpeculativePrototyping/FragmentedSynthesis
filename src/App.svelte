<script lang="ts">
  import './app.css';
  import { onMount, onDestroy } from 'svelte';
  import { bootGraph } from './lib/graph';

  const STORAGE_KEY = 'litegraph-flow';

  let canvasEl: HTMLCanvasElement | null = null;
  let graph: any;
  let canvas: any;
  let resizeObserver: ResizeObserver | null = null;
  let resizeFn: (() => void) | null = null;
  let seedSampleFn: (() => void) | null = null;

  const resizeCanvas = () => {
    if (typeof resizeFn === 'function') {
      resizeFn();
    } else if (canvas) {
      const el = canvas?.canvas as HTMLCanvasElement | undefined;
      const target = canvasEl ?? el;
      if (!target) return;
      const parent = target.parentElement;
      const rect = parent?.getBoundingClientRect();
      const width = rect?.width ?? window.innerWidth;
      const height = rect?.height ?? window.innerHeight;
      canvas.resize(width, height);
    }
  };

  const saveGraph = () => {
    if (!graph) return;
    try {
      const data = graph.serialize();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      alert('Graph saved.');
    } catch (error) {
      console.error(error);
      alert('Failed to save graph.');
    }
  };

  const clearGraph = () => {
    if (!graph) return;
    graph.stop?.();
    graph.clear();
    seedSampleFn?.();
    graph.start?.();
    graph.runStep?.();
    resizeCanvas();
  };

  const loadGraph = () => {
    if (!graph) return;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      alert('No saved graph found.');
      return;
    }
    try {
      const data = JSON.parse(raw);
      graph.stop?.();
      graph.clear();
      graph.configure(data);
      graph.start();
      graph.runStep?.();
      resizeCanvas();
    } catch (error) {
      console.error(error);
      alert('Failed to load graph.');
    }
  };

  onMount(() => {
    const canvasTarget = canvasEl ?? '#graph';
    const ctx = bootGraph(canvasTarget as any);
    graph = ctx.graph;
    canvas = ctx.canvas;
    resizeFn = ctx.resize;
    seedSampleFn = ctx.seedSample;

    resizeCanvas();
    graph.runStep?.();

    const handleResize = () => resizeCanvas();
    window.addEventListener('resize', handleResize);

    if (canvasEl?.parentElement && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => resizeCanvas());
      resizeObserver.observe(canvasEl.parentElement);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeObserver && canvasEl?.parentElement) {
        resizeObserver.unobserve(canvasEl.parentElement);
      }
      resizeObserver = null;
      graph?.stop?.();
      resizeFn = null;
      seedSampleFn = null;
    };
  });

  onDestroy(() => {
    if (resizeObserver && canvasEl?.parentElement) {
      resizeObserver.unobserve(canvasEl.parentElement);
    }
    resizeObserver = null;
    graph?.stop?.();
    resizeFn = null;
    seedSampleFn = null;
  });
</script>

<div class="app-root">
  <header class="toolbar">
    <div class="toolbar__title">LiteGraph Playground</div>
    <div class="toolbar__actions">
      <button type="button" on:click={saveGraph}>Save</button>
      <button type="button" on:click={loadGraph}>Load</button>
      <button type="button" on:click={clearGraph}>Clear</button>
    </div>
  </header>
  <div class="canvas-container">
    <canvas id="graph" bind:this={canvasEl}></canvas>
  </div>
</div>
