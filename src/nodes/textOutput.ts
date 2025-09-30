import { LiteGraph as LG } from 'litegraph.js';
import { drawTextBox } from '../lib/textBox';

type LiteGraphStatic = typeof LG;

const NODE_TYPE = 'app/text_output';

export default function registerTextOutput(liteGraph: LiteGraphStatic = LG) {
  const lg = liteGraph as any;
  if (lg.registered_node_types?.[NODE_TYPE]) return;

  function TextOutput(this: any) {
    this.addInput('text', 'string');
    this.properties = { preview: '' };
    this.size = [260, 120];
  }

  (TextOutput as any).title = 'Text Output';
  (TextOutput as any).prototype.onExecute = function () {
    const value = this.getInputData(0);
    const text = typeof value === 'string' ? value : value == null ? '' : String(value);
    if (text !== this.properties.preview) {
      this.properties.preview = text;
      this.setDirtyCanvas(true, true);
    }
  };

  (TextOutput as any).prototype.onDrawForeground = function (ctx: CanvasRenderingContext2D) {
    const areaX = 12;
    const areaY = 12 + 18;
    const areaWidth = this.size[0] - 24;
    const areaHeight = this.size[1] - areaY - 12;
    const text = String(this.properties.preview || '');

    drawTextBox(
      ctx,
      { x: areaX, y: areaY, width: areaWidth, height: areaHeight },
      text,
      {
        background: '#f7f7f7',
        border: '#d0d0d0',
        textColor: '#333',
        placeholder: '',
        lineHeight: 16,
        padding: 10,
        font: '12px system-ui, sans-serif',
      }
    );
  };

  liteGraph.registerNodeType(NODE_TYPE, TextOutput as any);
}
