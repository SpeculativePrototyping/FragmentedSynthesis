// Minimal inline text block for LiteGraph nodes (wrap + overlay textarea)
export function makeTextBlock(node, {
  x = 8, y = 22, w = -16, h = -30,          // -values = from node.size with padding
  font = "12px sans-serif", lineH = 16,
  placeholder = "type…"
} = {}) {
  const state = { value: "", editing: false };

  function _rect() {
    const W = (w < 0 ? node.size[0] + w : w);
    const H = (h < 0 ? node.size[1] + h : h);
    return { x, y, w: W, h: H };
  }

  function set(v) { state.value = String(v ?? ""); }
  function get() { return state.value; }

  function _wrap(ctx, text, maxW) {
    ctx.font = font;
    const out = [];
    for (const hard of String(text || "").split("\n")) {
      const words = hard.split(/(\s+)/); // keep spaces
      let line = "";
      for (const tok of words) {
        const test = line + tok;
        if (ctx.measureText(test).width > maxW && line) {
          out.push(line);
          line = tok;
        } else line = test;
      }
      out.push(line);
    }
    if (out.length === 0) out.push("");
    return out;
  }

  function draw(ctx) {
    const { x:rx, y:ry, w:rw, h:rh } = _rect();
    // background
    ctx.fillStyle = "#0f1115";
    ctx.fillRect(rx, ry, rw, rh);
    // text
    ctx.fillStyle = "#ddd";
    ctx.font = font;
    const lines = _wrap(ctx, state.value || placeholder, rw - 8);
    let yy = ry + 6 + 12;
    const maxY = ry + rh - 4;
    for (const ln of lines) {
      ctx.fillText(ln, rx + 6, yy);
      yy += lineH; if (yy > maxY) break;
    }
  }

  function _startEdit(graphcanvas) {
  if (state.editing) return;

  // ✅ robust graphcanvas resolution
  const gc =
    graphcanvas ||
    node.graphcanvas ||                         // many builds set this
    (node.graph && node.graph._graphcanvas) ||  // some forks keep a ref here
    null;

  if (!gc || !gc.canvas) return;                // bail out safely

  const canvas = gc.canvas;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  const { x:rx, y:ry, w:rw, h:rh } = _rect();
  const ds = gc.ds || { scale: 1, offset: [0, 0] };
  const sx = (node.pos[0] + rx) * ds.scale + ds.offset[0];
  const sy = (node.pos[1] + ry) * ds.scale + ds.offset[1];

  const ta = document.createElement("textarea");
  ta.className = "lg-inline-ta";
  Object.assign(ta.style, {
    position: "absolute",
    left: `${rect.left + sx}px`,
    top:  `${rect.top  + sy}px`,
    width: `${rw * ds.scale}px`,
    height:`${rh * ds.scale}px`,
    font: "12px sans-serif",
    color: "#eee",
    background: "#111",
    border: "1px solid #555",
    padding: "6px",
    resize: "none",
    outline: "none",
    zIndex: 10
  });
  ta.value = state.value;
  document.body.appendChild(ta);
  ta.focus();
  ta.select();

  function commit(){ state.value = ta.value; cleanup(); gc.setDirty(true,true); }
  function cancel(){ cleanup(); gc.setDirty(true,true); }
  function cleanup(){
    state.editing = false;
    window.removeEventListener("resize", cancel);
    ta.remove();
  }
  ta.addEventListener("keydown", e => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { commit(); e.preventDefault(); }
    else if (e.key === "Escape") { cancel(); e.preventDefault(); }
  });
  ta.addEventListener("blur", commit);
  window.addEventListener("resize", cancel);

  state.editing = true;
}

  function onMouseDown(e, pos, graphcanvas) {
    const { x:rx, y:ry, w:rw, h:rh } = _rect();
    if (LiteGraph.isInsideRectangle(pos[0], pos[1], rx, ry, rw, rh)) {
      _startEdit(graphcanvas);
      return true;
    }
    return false;
  }

  return { draw, onMouseDown, set, get };
}
