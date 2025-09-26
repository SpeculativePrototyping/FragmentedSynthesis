import { makeTextBlock } from "../ui/inline_text_block.js";

(function(){
  function TextEditorLite(){
    this.addOutput("text","string");
    this.size = [280, 150];
    this.block = makeTextBlock(this, { x:8, y:22, w:-16, h:-30, placeholder:"type here…" });
    this.properties = { value: "" };
  }
  TextEditorLite.title = "Text Editor (Lite)";
  TextEditorLite.prototype.onExecute = function(){
    this.properties.value = this.block.get();
    this.setOutputData(0, this.properties.value);
  };
  TextEditorLite.prototype.onDrawForeground = function(ctx){
    ctx.fillStyle = "#bbb"; ctx.font = "12px sans-serif";
    ctx.fillText("Text", 8, 14);
    this.block.draw(ctx);
  };
  TextEditorLite.prototype.onMouseDown = function (e, pos, graphcanvas) {
  return this.block.onMouseDown(e, pos, graphcanvas);
};
  TextEditorLite.prototype.onSerialize = function(o){ o.properties = { value: this.block.get() }; };
  TextEditorLite.prototype.onConfigure = function(o){ if (o?.properties?.value!=null) this.block.set(o.properties.value); };

  LiteGraph.registerNodeType("io/text_editor_lite", TextEditorLite);
})();
