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
  const summaryOut = LG.createNode('app/text_output');
  const extract = LG.createNode('app/extract_points');
  const pointsOut = LG.createNode('app/text_output');
  const docSection = LG.createNode('doc/compose_block');
  const docSubsection = LG.createNode('doc/compose_block');
  const documentRoot = LG.createNode('doc/document');
  const docRender = LG.createNode('doc/render');
  const latexOut = LG.createNode('app/text_output');

  const nodes = [
    textIn,
    summarize,
    summaryOut,
    extract,
    pointsOut,
    docSection,
    docSubsection,
    documentRoot,
    docRender,
    latexOut,
  ];

  if (nodes.every(Boolean)) {
    textIn.pos = [40, 120];
    summarize.pos = [320, 80];
    summaryOut.pos = [620, 80];
    extract.pos = [320, 280];
    pointsOut.pos = [620, 280];
    docSection.pos = [900, 60];
    docSubsection.pos = [900, 260];
    documentRoot.pos = [1180, 160];
    docRender.pos = [1460, 160];
    latexOut.pos = [1720, 160];

    docSection.properties.title = 'Summary';
    docSection.updateSpec?.();
    docSubsection.properties.elementKey = 'subsection';
    docSubsection.properties.title = 'Key Points';
    docSubsection.updateSpec?.();
    documentRoot.ensureSlots?.();

    nodes.forEach((node) => graph.add(node));

    textIn.connect(0, summarize, 0);
    summarize.connect(0, summaryOut, 0);
    summarize.connect(0, docSection, 0);

    textIn.connect(0, extract, 0);
    extract.connect(0, pointsOut, 0);
    extract.connect(0, docSubsection, 0);

    docSection.connect(0, documentRoot, 0);
    docSubsection.connect(0, documentRoot, 1);

    documentRoot.connect(0, docRender, 0);
    docRender.connect(0, latexOut, 0);
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
