import { LiteGraph as LG } from 'litegraph.js';
import { paragraphFromString } from '../../doc/docModel';

type LiteGraphStatic = typeof LG;

const NODE_TYPE = 'doc/from_string';
const OUTPUT_TYPE = 'doc:paragraph';

export default function registerDocFromString(lg: LiteGraphStatic = LG) {
  const registry = lg as any;
  if (registry.registered_node_types?.[NODE_TYPE]) return;

  function DocFromStringNode(this: any) {
    this.addInput('Text', 'string');
    this.addOutput('Paragraph', OUTPUT_TYPE);
    this.addOutput('Echo', 'string');
    this.size = [220, 140];
    this.properties = {
      fallback: '',
    };

    this.addWidget(
      'text',
      'Fallback',
      this.properties.fallback,
      (value: string) => {
        this.properties.fallback = value ?? '';
        return value;
      },
      { placeholder: 'Placeholder when input empty…' }
    );
  }

  (DocFromStringNode as any).title = 'Doc From String';

  (DocFromStringNode as any).prototype.onExecute = function () {
    const source = this.getInputData(0);
    const text = typeof source === 'string' && source.trim().length > 0
      ? source
      : this.properties.fallback ?? '';

    const doc = paragraphFromString(text);
    this.setOutputData(0, doc);
    this.setOutputData(1, text);
  };

  lg.registerNodeType(NODE_TYPE, DocFromStringNode as any);
}
