import { LiteGraph as LG } from 'litegraph.js';
import {
  DocBlock,
  DocElement,
  DocText,
  paragraphFromString,
} from '../../doc/docModel';
import type { DocPart } from '../../doc/docModel';

const NODE_TYPE = 'doc/compose_block';
const GENERAL_TYPE = 'doc:part';

type LiteGraphStatic = typeof LG;

type ElementKey = 'section' | 'subsection' | 'subsubsection';

type ElementSpec = {
  element: DocElement;
  label: string;
  outputType: string;
  requiresTitle: boolean;
  allowedChildren: string[];
  placeholder?: string;
};

const ELEMENT_SPECS: Record<ElementKey, ElementSpec> = {
  section: {
    element: DocElement.Section,
    label: 'Section',
    outputType: 'doc:section',
    requiresTitle: true,
    allowedChildren: ['doc:subsection', 'doc:paragraph', 'doc:list', 'doc:figure', 'doc:table', 'doc:quote', 'doc:math-block', GENERAL_TYPE, 'string'],
    placeholder: 'Section title',
  },
  subsection: {
    element: DocElement.Subsection,
    label: 'Subsection',
    outputType: 'doc:subsection',
    requiresTitle: true,
    allowedChildren: ['doc:subsubsection', 'doc:paragraph', 'doc:list', 'doc:figure', 'doc:table', 'doc:quote', 'doc:math-block', GENERAL_TYPE, 'string'],
    placeholder: 'Subsection title',
  },
  subsubsection: {
    element: DocElement.Subsubsection,
    label: 'Subsubsection',
    outputType: 'doc:subsubsection',
    requiresTitle: true,
    allowedChildren: ['doc:paragraph', 'doc:list', 'doc:figure', 'doc:table', 'doc:quote', 'doc:math-block', GENERAL_TYPE, 'string'],
    placeholder: 'Heading…',
  },
};

function getSpec(key: ElementKey): ElementSpec {
  return ELEMENT_SPECS[key] ?? ELEMENT_SPECS.section;
}

function toDocPart(value: unknown): DocPart | null {
  if (!value) return null;
  if (typeof value === 'string') {
    if (!value.trim()) return null;
    return paragraphFromString(value);
  }
  if (Array.isArray(value)) {
    const parts = value
      .map((item) => toDocPart(item))
      .filter(Boolean) as DocPart[];
    if (!parts.length) return null;
    const block = new DocBlock(DocElement.Paragraph);
    parts.forEach((part) => block.children.push(part));
    return block;
  }
  if (typeof value === 'object' && typeof (value as DocPart).render === 'function') {
    return value as DocPart;
  }
  return null;
}

export default function registerDocComposeBlock(liteGraph: LiteGraphStatic = LG) {
  const lg = liteGraph as any;
  if (lg.registered_node_types?.[NODE_TYPE]) return;

  function DocComposeNode(this: any) {
    this.properties = {
      elementKey: 'section' as ElementKey,
      title: '',
    };

    const spec = getSpec(this.properties.elementKey);

    this.addOutput(spec.label, spec.outputType);
    this.size = [320, 220];

    this._elementWidget = this.addWidget(
      'combo',
      'Element',
      this.properties.elementKey,
      (value: ElementKey) => {
        this.properties.elementKey = value;
        this.updateSpec();
        this.setDirtyCanvas(true, true);
        return value;
      },
      { values: Object.keys(ELEMENT_SPECS) }
    );

    this._titleWidget = this.addWidget(
      'text',
      'Title',
      this.properties.title,
      (value: string) => {
        this.properties.title = value ?? '';
        this.setDirtyCanvas(true, true);
        return value;
      }
    );

    this.ensureChildInputs();
    this.updateSpec();
  }

  (DocComposeNode as any).title = 'Doc Block';

  (DocComposeNode as any).prototype.updateSpec = function () {
    const spec = getSpec(this.properties.elementKey);
    if (this.outputs?.length) {
      this.outputs[0].type = spec.outputType;
      this.outputs[0].name = spec.label;
    }

    if (this._titleWidget) {
      this._titleWidget.disabled = !spec.requiresTitle;
      this._titleWidget.hidden = !spec.requiresTitle;
      if (!spec.requiresTitle) {
        this.properties.title = '';
        this._titleWidget.value = '';
      }
      if (spec.placeholder) {
        this._titleWidget.options = { ...(this._titleWidget.options || {}), placeholder: spec.placeholder };
      }
    }

    this.refreshChildInputs();
    this.ensureChildInputs();
    this.validateConnections();
    this.setDirtyCanvas(true, true);
  };

  (DocComposeNode as any).prototype.refreshChildInputs = function () {
    const spec = getSpec(this.properties.elementKey);
    if (!this.inputs) return;
    this.inputs.forEach((input: any, idx: number) => {
      input.name = `Child ${idx + 1}`;
      input.type = '*';
      input.allowed = spec.allowedChildren;
    });
  };

  (DocComposeNode as any).prototype.ensureChildInputs = function () {
    const inputs = this.inputs || [];
    const spec = getSpec(this.properties.elementKey);
    const free = inputs.filter((input: any) => !input.link).length;

    if (!inputs.length || free === 0) {
      this.addInput(`Child ${inputs.length + 1}`, '*');
    }

    if (this.inputs?.length) {
      this.inputs.forEach((input: any) => {
        input.allowed = spec.allowedChildren;
        input.type = '*';
      });
    }
  };

  (DocComposeNode as any).prototype.onConnectionsChange = function () {
    this.refreshChildInputs();
    this.ensureChildInputs();
  };

  (DocComposeNode as any).prototype.onConnectInput = function (_inputIndex: number, outputType: string) {
    const spec = getSpec(this.properties.elementKey);
    if (!outputType) return false;
    if (outputType === '*' || outputType === GENERAL_TYPE) return true;
    if (outputType === 'string') return spec.allowedChildren.includes('string');
    return spec.allowedChildren.includes(outputType);
  };

  (DocComposeNode as any).prototype.validateConnections = function () {
    const spec = getSpec(this.properties.elementKey);
    if (!this.inputs) return;
    this.inputs.forEach((input: any, idx: number) => {
      const link = input.link;
      if (link == null) return;
      const linkInfo = this.graph.links?.[link];
      if (!linkInfo) return;
      const outNode = this.graph.getNodeById(linkInfo.origin_id);
      const outType = outNode?.outputs?.[linkInfo.origin_slot]?.type;
      if (!outType) return;
      if (outType === '*' || outType === GENERAL_TYPE) return;
      if (outType === 'string' && spec.allowedChildren.includes('string')) return;
      if (!spec.allowedChildren.includes(outType)) {
        this.disconnectInput(idx);
      }
    });
  };

  (DocComposeNode as any).prototype.onExecute = function () {
    const spec = getSpec(this.properties.elementKey);
    const block = new DocBlock(spec.element, spec.requiresTitle ? this.properties.title ?? '' : '');

    if (this.inputs) {
      this.inputs.forEach((_input: any, idx: number) => {
        const data = this.getInputData(idx);
        const part = toDocPart(data);
        if (part) block.children.push(part);
      });
    }

    this.setOutputData(0, block);
    this.ensureChildInputs();
  };

  (DocComposeNode as any).prototype._describeInput = function (idx: number) {
    const input = this.inputs?.[idx];
    if (!input) return `Child ${idx + 1}: [unused]`;
    const linkId = input.link;
    if (linkId == null) return `Child ${idx + 1}: [empty]`;
    const link = this.graph?.links?.[linkId];
    if (!link) return `Child ${idx + 1}: [link]`;
    const source = this.graph?.getNodeById(link.origin_id);
    if (!source) return `Child ${idx + 1}: [node]`;
    const title = source.properties?.title || source.properties?.text || source.properties?.value || source.title || source.type || '';
    const summary = typeof title === 'string' ? title.split('\n')[0].trim() : '';
    const preview = summary ? summary.slice(0, 42) + (summary.length > 42 ? '…' : '') : '[content]';
    return `Child ${idx + 1}: ${preview}`;
  };

  (DocComposeNode as any).prototype.onDrawForeground = function (ctx: CanvasRenderingContext2D) {
    const spec = getSpec(this.properties.elementKey);
    const headerHeight = (LG as any).NODE_TITLE_HEIGHT || 24;
    const padding = 10;
    const startY = headerHeight + padding;
    const lineHeight = 16;

    ctx.save();
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = '#9da7c0';
    ctx.textBaseline = 'top';

    ctx.fillText(`Element: ${spec.label}`, padding, headerHeight - 14);
    const title = spec.requiresTitle ? (this.properties.title || '(untitled)') : '—';
    ctx.fillText(`Title: ${title}`, padding, headerHeight + 2);

    const inputs = this.inputs || [];
    inputs.forEach((_input: any, idx: number) => {
      const label = this._describeInput(idx);
      ctx.fillStyle = '#c3cbe1';
      ctx.fillText(label, padding, startY + idx * lineHeight);
    });

    ctx.restore();
  };

  liteGraph.registerNodeType(NODE_TYPE, DocComposeNode as any);
}
