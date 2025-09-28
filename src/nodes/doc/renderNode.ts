import { LiteGraph as LG } from 'litegraph.js';
import { renderDoc } from '../../doc/docModel';

const NODE_TYPE = 'doc/render';

type LiteGraphStatic = typeof LG;

export default function registerDocRenderNode(lg: LiteGraphStatic = LG) {
  const registry = lg as any;
  if (registry.registered_node_types?.[NODE_TYPE]) return;

  function DocRenderNode(this: any) {
    this.addInput('Doc Part', 'doc:part');
    this.addOutput('LaTeX', 'string');
    this.addOutput('Preview', 'doc:preview');
    this.size = [260, 160];
    this.properties = {
      trimWhitespace: true,
    };

    this.addWidget(
      'toggle',
      'Trim whitespace',
      this.properties.trimWhitespace,
      (value: boolean) => {
        this.properties.trimWhitespace = !!value;
        return !!value;
      }
    );
  }

  (DocRenderNode as any).title = 'Render Doc';

  (DocRenderNode as any).prototype.onExecute = function () {
    const data = this.getInputData(0);
    const latex = data ? renderDoc(data) : '';
    const output = this.properties.trimWhitespace ? latex.trim() : latex;
    this.setOutputData(0, output);
    this.setOutputData(1, output);
  };

  lg.registerNodeType(NODE_TYPE, DocRenderNode as any);
}
