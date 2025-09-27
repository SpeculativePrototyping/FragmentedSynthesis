import 'litegraph.js/css/litegraph.css';
import { LGraph, LGraphCanvas, LiteGraph as LG } from 'litegraph.js';
import { registerAllNodes } from './nodeRegistry';

type Target = string | HTMLCanvasElement;

function normaliseTarget(target: Target): Target {
  return target;
}

function seedSample(graph: LGraph) {
  if (graph._nodes && graph._nodes.length) return;

  const textIn = LG.createNode('app/text_input');
  const summarize = LG.createNode('app/summarize');
  const textOut = LG.createNode('app/text_output');

  if (textIn && summarize && textOut) {
    textIn.pos = [40, 100];
    summarize.pos = [320, 120];
    textOut.pos = [600, 140];

    graph.add(textIn);
    graph.add(summarize);
    graph.add(textOut);

    textIn.connect(0, summarize, 0);
    summarize.connect(0, textOut, 0);
  }
}

export function bootGraph(target: Target = '#graph') {
  registerAllNodes(LG);

  const graph = new LGraph();
  const canvas = new LGraphCanvas(normaliseTarget(target), graph);
  (canvas as any).allow_searchbox = false;
  (canvas as any).showSearchBox = () => {};

  const resize = () => {
    const el = canvas.canvas as HTMLCanvasElement | undefined;
    if (!el) return;
    const parent = el.parentElement;
    const rect = parent?.getBoundingClientRect();
    const width = rect?.width ?? window.innerWidth;
    const height = rect?.height ?? window.innerHeight;
    canvas.resize(width, height);
  };

  graph.start();
  seedSample(graph);
  resize();

  return { graph, canvas, resize, seedSample: () => seedSample(graph) };
}
