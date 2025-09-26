// public/nodes/text-viewer.js
function TextViewerNode() {
  this.addInput("text", "string");
  this.size = [220, 120];
  this.properties = { content: "" };
}

TextViewerNode.title = "Text Viewer";
TextViewerNode.desc  = "Display incoming text (wrapped)";

TextViewerNode.prototype.onExecute = function () {
  const input = this.getInputData(0);
  this.properties.content = (input == null) ? "" : String(input);
};

TextViewerNode.prototype.onDrawForeground = function (ctx) {
  if (this.flags.collapsed) return;

  const pad = 10;
  const maxW = this.size[0] - pad * 2;
  const lineH = 14;

  ctx.fillStyle = "#aaa";
  ctx.font = "12px sans-serif";

  const text = this.properties.content || "(no input)";
  const words = text.split(/\s+/);
  let line = "";
  let y = 20;

  for (let i = 0; i < words.length; i++) {
    const test = line ? line + " " + words[i] : words[i];
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, pad, y);
      y += lineH;
      line = words[i];
      if (y > this.size[1] - 8) break;
    } else {
      line = test;
    }
  }
  if (y <= this.size[1] - 8) ctx.fillText(line, pad, y);
};

LiteGraph.registerNodeType("display/text_viewer", TextViewerNode);
