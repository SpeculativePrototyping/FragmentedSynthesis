import { LiteGraph as LG } from 'litegraph.js';

type LiteGraphStatic = typeof LG;

const NODE_TYPE = 'app/concat';

export default function registerConcat(liteGraph: LiteGraphStatic = LG) {
  const lg = liteGraph as any;
  if (lg.registered_node_types?.[NODE_TYPE]) return;

  function ConcatNode(this: any) {
    this.properties = { joiner: ' ' };
    this.addOutput('text', 'string');
    this.addInput('in0', 'string');
    this.size = [240, 80];
    this._ensureSpareInput();
  }

  (ConcatNode as any).title = 'Concat';

  (ConcatNode as any).prototype._ensureSpareInput = function () {
    const inputs = this.inputs || [];
    const freeIndices = inputs
      .map((input: any, idx: number) => (input?.link == null ? idx : -1))
      .filter((idx: number) => idx !== -1);

    if (freeIndices.length === 0) {
      this.addInput(`in${inputs.length}`, 'string');
      this.inputs[this.inputs.length - 1].link = null;
    } else if (freeIndices.length > 1) {
      for (let i = this.inputs.length - 1; i >= 0 && this.inputs.length > 1; i -= 1) {
        if (this.inputs[i]?.link == null && freeIndices.length > 1) {
          this.removeInput(i);
          freeIndices.pop();
        }
      }
    }

    (this.inputs || []).forEach((input: any, idx: number) => {
      input.name = `in${idx}`;
    });

    this.setDirtyCanvas(true, true);
  };

  (ConcatNode as any).prototype.onConnectionsChange = function (type: number) {
    if (type === (LG as any).INPUT) {
      this._ensureSpareInput();
    }
  };

  (ConcatNode as any).prototype.onAdded = function () {
    this._ensureSpareInput();
  };

  (ConcatNode as any).prototype.onExecute = function () {
    this._ensureSpareInput();
    const inputs = this.inputs || [];
    const joiner = typeof this.properties.joiner === 'string' ? this.properties.joiner : ' ';
    const parts: string[] = [];
    for (let i = 0; i < inputs.length; i += 1) {
      const data = this.getInputData(i);
      if (data != null && data !== '') {
        parts.push(String(data));
      }
    }
    this.setOutputData(0, parts.join(joiner));
  };

  liteGraph.registerNodeType(NODE_TYPE, ConcatNode as any);
}
