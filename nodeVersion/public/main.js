// Import your nodes (side effect: register themselves with LiteGraph)
import "./ui/inline_text_block.js";
import "./nodes/text-editor-lite.js";
import "./nodes/text-viewer.js";

const canvasEl = document.getElementById("graph");

// Fix HiDPI scaling (so text isn't blurry)
function resizeForHiDPI() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvasEl.getBoundingClientRect();
  canvasEl.width  = Math.round(rect.width  * dpr);
  canvasEl.height = Math.round(rect.height * dpr);
  const ctx = canvasEl.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resizeForHiDPI();
window.addEventListener("resize", resizeForHiDPI);

// Create graph + canvas
const graph  = new LGraph();
const canvas = new LGraphCanvas(canvasEl, graph);
canvas.setZoom(0.8, [0,0]);

// Demo: spawn editor + viewer
const editor = LiteGraph.createNode("io/text_editor_lite");
editor.pos = [40, 40];
graph.add(editor);

const viewer = LiteGraph.createNode("display/text_viewer");
viewer.pos = [360, 40];
graph.add(viewer);

editor.connect(0, viewer, 0);

// Run graph
graph.start();
