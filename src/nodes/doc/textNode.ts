import { LiteGraph as LG } from 'litegraph.js';
import { paragraphFromString } from '../../doc/docModel';

const NODE_TYPE = 'doc/text';
const OUTPUT_TYPE = 'doc:paragraph';

export default function registerDocTextNode(lg: typeof LG = LG) {
  const registry = lg as any;
  if (registry.registered_node_types?.[NODE_TYPE]) return;

  function DocTextNode(this: any) {
    this.properties = {
      text: '',
      grammarly: false,
    };

    this.size = [280, 220];
    this.widgets_start_y = this.size[1] - 60;

    this.addOutput('Doc Text', OUTPUT_TYPE);

    this.addWidget(
      'multiline',
      'Content',
      this.properties.text,
      (value: string) => {
        this.properties.text = value ?? '';
        this.setDirtyCanvas(true, true);
        return value;
      },
      {
        placeholder: 'Write paragraph text…',
        spellcheck: true,
        grammarly: this.properties.grammarly,
        minHeight: 120,
        maxHeight: 360,
      }
    );

    this.addWidget(
      'toggle',
      'Enable Grammarly',
      this.properties.grammarly,
      (value: boolean) => {
        this.properties.grammarly = !!value;
        if (Array.isArray(this.widgets)) {
          const multiline = this.widgets.find((w: any) => w.name === 'Content');
          if (multiline) {
            multiline.options = {
              ...(multiline.options || {}),
              grammarly: this.properties.grammarly,
            };
          }
        }
        return !!value;
      }
    );
  }

  (DocTextNode as any).title = 'Doc Text';

  (DocTextNode as any).prototype.onExecute = function () {
    const text = (this.properties.text || '').trim();
    const block = paragraphFromString(text);
    this.setOutputData(0, block);
  };

  (DocTextNode as any).prototype.onDrawForeground = function (ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.fillStyle = '#555';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText('Outputs a LaTeX-safe DocText block.', 12, 8);
    ctx.restore();
  };

  lg.registerNodeType(NODE_TYPE, DocTextNode as any);
}
