import { LiteGraph as LG } from 'litegraph.js';
import { DocComposite, paragraphFromString } from '../../doc/docModel';
import type { DocPart } from '../../doc/docModel';

const NODE_TYPE = 'doc/document';
const INPUT_TYPE = 'doc:section';
const OUTPUT_TYPE = 'doc:part';

type LiteGraphStatic = typeof LG;

function toPart(value: unknown): DocPart | null {
  if (!value) return null;
  if (typeof value === 'string') {
    if (!value.trim()) return null;
    return paragraphFromString(value);
  }
  if (Array.isArray(value)) {
    const composite = new DocComposite();
    value.forEach((entry) => {
      const part = toPart(entry);
      if (part) composite.add(part);
    });
    return composite;
  }
  if (typeof value === 'object' && typeof (value as DocPart).render === 'function') {
    return value as DocPart;
  }
  return null;
}

export default function registerDocDocumentNode(lg: LiteGraphStatic = LG) {
  const registry = lg as any;
  if (registry.registered_node_types?.[NODE_TYPE]) return;

  function DocDocumentNode(this: any) {
    this.size = [320, 200];
    this.properties = {
      label: 'Document'
    };

    this.addOutput('Document', OUTPUT_TYPE);
    this.ensureSlots();
  }

  (DocDocumentNode as any).title = 'Document';

  (DocDocumentNode as any).prototype.ensureSlots = function () {
    const inputs = this.inputs || [];
    const free = inputs.filter((input: any) => !input.link).length;
    if (!inputs.length || free === 0) {
      this.addInput(`Section ${inputs.length + 1}`, INPUT_TYPE);
    }
    (this.inputs || []).forEach((input: any, idx: number) => {
      input.name = `Section ${idx + 1}`;
      input.type = INPUT_TYPE;
    });
  };

  (DocDocumentNode as any).prototype.onConnectionsChange = function () {
    this.ensureSlots();
  };

  (DocDocumentNode as any).prototype.onExecute = function () {
    const composite = new DocComposite();
    (this.inputs || []).forEach((_input: any, idx: number) => {
      const data = this.getInputData(idx);
      const part = toPart(data);
      if (part) composite.add(part);
    });
    this.setOutputData(0, composite);
    this.ensureSlots();
  };

  (DocDocumentNode as any).prototype.onDrawForeground = function (ctx: CanvasRenderingContext2D) {
    const headerHeight = (LG as any).NODE_TITLE_HEIGHT || 24;
    const padding = 10;
    const lineHeight = 16;
    ctx.save();
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = '#9da7c0';
    ctx.textBaseline = 'top';
    ctx.fillText('Document Root', padding, headerHeight - 12);
    (this.inputs || []).forEach((_input: any, idx: number) => {
      const label = this.describeInput(idx);
      ctx.fillText(label, padding, headerHeight + 6 + idx * lineHeight);
    });
    ctx.restore();
  };

  (DocDocumentNode as any).prototype.describeInput = function (idx: number) {
    const input = this.inputs?.[idx];
    if (!input) return `Section ${idx + 1}: [unused]`;
    const linkId = input.link;
    if (linkId == null) return `Section ${idx + 1}: [empty]`;
    const link = this.graph?.links?.[linkId];
    if (!link) return `Section ${idx + 1}: [link]`;
    const source = this.graph?.getNodeById(link.origin_id);
    if (!source) return `Section ${idx + 1}: [node]`;
    const title = source.properties?.title || source.properties?.label || source.title || source.type || '';
    const summary = typeof title === 'string' ? title.split('\n')[0].trim() : '';
    const preview = summary ? summary.slice(0, 40) + (summary.length > 40 ? '…' : '') : '[section]';
    return `Section ${idx + 1}: ${preview}`;
  };

  lg.registerNodeType(NODE_TYPE, DocDocumentNode as any);
}
