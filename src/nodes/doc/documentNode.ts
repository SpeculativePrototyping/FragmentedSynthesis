import { LiteGraph as LG } from 'litegraph.js';
import { DocComposite, paragraphFromString } from '../../doc/docModel';
import type { DocPart } from '../../doc/docModel';
import { drawInputPreviewList } from '../utils/visuals';

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
    this.size = [380, 220];
    this.properties = {
      label: 'Document'
    };

    this.addOutput('Document', OUTPUT_TYPE);
    this.ensureSlots();
    this.updateNodeSize();
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
    this.updateNodeSize();
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

  (DocDocumentNode as any).prototype.updateNodeSize = function () {
    const count = (this.inputs?.length ?? 0) || 1;
    const headerHeight = (LG as any).NODE_TITLE_HEIGHT || 24;
    const padding = 20;
    const lineHeight = 18;
    const desiredHeight = headerHeight + padding + count * lineHeight + 80;
    const minHeight = 220;
    const nextHeight = Math.max(minHeight, desiredHeight);
    if (this.size[1] !== nextHeight) {
      this.size = [this.size[0], nextHeight];
    }
  };

  (DocDocumentNode as any).prototype.onDrawForeground = function (ctx: CanvasRenderingContext2D) {
    const headerHeight = (LG as any).NODE_TITLE_HEIGHT || 24;
    const padding = 10;
    const items = (this.inputs || []).map((_input: any, idx: number) => ({
      label: `Section ${idx + 1}`,
      value: this.describeInputValue(idx),
    }));

    drawInputPreviewList({
      ctx,
      title: 'Document Root',
      items,
      x: padding + 18,
      y: headerHeight - 12,
      lineHeight: 16,
    });
  };

  (DocDocumentNode as any).prototype.describeInputValue = function (idx: number) {
    const input = this.inputs?.[idx];
    if (!input) return '[unused]';
    const linkId = input.link;
    if (linkId == null) return '[empty]';
    const link = this.graph?.links?.[linkId];
    if (!link) return '[link]';
    const source = this.graph?.getNodeById(link.origin_id);
    if (!source) return '[node]';
    const title = source.properties?.title || source.properties?.label || source.title || source.type || '';
    const summary = typeof title === 'string' ? title.split('\n')[0].trim() : '';
    const preview = summary ? summary.slice(0, 42) + (summary.length > 42 ? '…' : '') : '[section]';
    return preview;
  };

  lg.registerNodeType(NODE_TYPE, DocDocumentNode as any);
}
