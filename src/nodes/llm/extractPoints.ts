import { LiteGraph as LG } from 'litegraph.js';
import { drawTextBox } from '../../lib/textBox';
import { buildKeyPointsSchema } from '../utils/jsonSchemas';
import { enqueueLlm, initLlmState } from './llmHelpers';
import { drawStatusPanel } from '../utils/visuals';

type LiteGraphStatic = typeof LG;

const NODE_TYPE = 'app/extract_points';
const DEFAULT_POINTS = 3;
const MAX_POINTS = 10;
const BASE_PROMPT =
  "You are a careful assistant. Identify the {n} most important points in the supplied text. Return only JSON following the provided schema.";

export default function registerExtractPoints(liteGraph: LiteGraphStatic = LG) {
  const lg = liteGraph as any;
  if (lg.registered_node_types?.[NODE_TYPE]) return;

  function ExtractPointsNode(this: any) {
    this.addInput('text', 'string');
    //this.addOutput('result', 'object'); //ToDo: at some point later we should make it easy to access the underground workings of these llm enabled points but for now not.

    this.properties = {
      points: DEFAULT_POINTS,
      status: 'idle',
      error: '',
      results: [] as string[],
      expanded: false,
    };

    this.size = [400, 320];
    this.widgets_start_y = this.size[1] - 72;
    this._lastInput = '';
    this._llm = initLlmState(this);

    const options = Array.from({ length: MAX_POINTS }, (_, i) => String(i + 1));
    this._pointsWidget = this.addWidget(
      'combo',
      '# Points',
      String(this.properties.points),
      (value: string) => {
        const parsed = parseInt(value, 10);
        const clamped = clampPoints(Number.isNaN(parsed) ? DEFAULT_POINTS : parsed);
        if (clamped !== this.properties.points) {
          this.properties.points = clamped;
          this.refreshOutputs();
          this.queueExtraction(true);
        }
        return String(clamped);
      },
      { values: options }
    );

    this.addWidget('toggle', 'Expanded', this.properties.expanded, (value: boolean) => {
      this.properties.expanded = !!value;
      this.setDirtyCanvas(true, true);
      return !!value;
    });

    this.addWidget('button', 'Retry', 'Extract', () => {
      this.queueExtraction(true);
      return false;
    });

    this.refreshOutputs();
  }

  (ExtractPointsNode as any).title = 'Extract Key Points';

  (ExtractPointsNode as any).prototype.refreshOutputs = function () {
    const desired = clampPoints(this.properties.points);
    const currentOutputs = Math.max(0, (this.outputs?.length || 0) - 1);
    const addCount = desired - currentOutputs;
    if (addCount > 0) {
      for (let i = 0; i < addCount; i += 1) {
        this.addOutput(`Point ${currentOutputs + i + 1}`, 'string');
      }
    } else if (addCount < 0) {
      for (let i = 0; i < Math.abs(addCount); i += 1) {
        if (this.outputs.length > 1) {
          this.removeOutput(this.outputs.length - 1);
        }
      }
    }

    for (let i = 1; i < (this.outputs?.length || 0); i += 1) {
      const slot = this.outputs[i];
      if (slot) slot.name = `Point ${i}`;
    }

    const existingResults = Array.isArray(this.properties.results) ? this.properties.results : [];
    const nextResults = new Array(desired).fill('');
    for (let i = 0; i < Math.min(existingResults.length, desired); i += 1) {
      nextResults[i] = existingResults[i];
    }

    this.properties.points = desired;
    this.properties.results = nextResults;
    this.setDirtyCanvas(true, true);
  };

  (ExtractPointsNode as any).prototype.onExecute = function () {
    const incoming = this.getInputData(0);
    const text = typeof incoming === 'string' ? incoming : '';

    if (text !== this._lastInput) {
      this._lastInput = text;
      this.queueExtraction(false);
    }

    const results = this.properties.results || [];
    results.forEach((value: string, idx: number) => {
      this.setOutputData(idx + 1, value || '');
    });
    this.setOutputData(0, results);

    if (this._pointsWidget && this._pointsWidget.value !== String(this.properties.points)) {
      this._pointsWidget.value = String(this.properties.points);
    }
  };

  (ExtractPointsNode as any).prototype.onDrawForeground = function (ctx: CanvasRenderingContext2D) {
    const headerHeight = (LG as any).NODE_TITLE_HEIGHT || 24;
    const padding = 12;
    const statusY = padding + 4;

    drawStatusPanel({
      ctx,
      width: this.size[0],
      top: statusY,
      status: `Status: ${this.properties.status || 'idle'}`,
      error: this.properties.error,
    });

    const areaX = padding;
    const areaY = headerHeight + 40;
    const areaW = this.size[0] - padding * 2;
    const widgetTop = this.widgets_start_y || this.size[1] - padding;
    const areaH = Math.max(90, widgetTop - areaY - 12);
    const preview = buildPreviewList(this.properties.results || []);

    drawTextBox(
      ctx,
      { x: areaX, y: areaY, width: areaW, height: areaH },
      preview,
      {
        background: '#f7f7f7',
        border: '#d0d0d0',
        focusedBackground: '#eef7ff',
        focusedBorder: '#88aaff',
        selectedBorder: '#315efb',
        textColor: '#222',
        placeholder: this.properties.status === 'idle' ? 'Key points will appear here…' : '',
        padding: 10,
        lineHeight: 18,
        font: '13px system-ui, sans-serif',
        collapsedLines: 4,
        expandedLines: 16,
        showToggleHint: true,
      },
      {
        expanded: !!this.properties.expanded || !!this.is_selected,
        selected: !!this.is_selected,
      }
    );
  };

  (ExtractPointsNode as any).prototype.queueExtraction = function (force: boolean) {
    const text = (this._lastInput || '').trim();
    const points = clampPoints(this.properties.points);

    if (!text) {
      this.properties.status = 'idle';
      this.properties.error = '';
      this.properties.results = new Array(points).fill('');
      updateOutputs(this, []);
      this.setDirtyCanvas(true, true);
      return;
    }

    const signature = `${text}::${points}`;
    if (!force && this._pending && this._pending.signature === signature) {
      return;
    }

    this.properties.status = 'queued…';
    this.properties.error = '';
    this.setDirtyCanvas(true, true);

    const schema = buildKeyPointsSchema(points, true);
    const sysPrompt = BASE_PROMPT.replace('{n}', String(points));
    const userPrompt = `${text}\nReturn only JSON per schema.`;

    const metadata = { signature } as any;
    this._pending = metadata;

    enqueueLlm(this, {
      user: userPrompt,
      sys: sysPrompt,
      responseFormat: schema,
      onStart: () => {
        if (this._pending !== metadata) return;
        this.properties.status = 'processing…';
        this.setDirtyCanvas(true, true);
      }
    }, { key: 'extractPoints', inputHash: signature })
      .then((result) => {
        if (this._pending !== metadata) throw new Error('stale-result');
        const parsed = parsePoints(result.message, points);
        this.properties.results = parsed;
        this.properties.status = parsed.some(Boolean) ? 'done' : 'done (empty)';
        this.properties.error = '';
        updateOutputs(this, parsed);
        this.setDirtyCanvas(true, true);
      })
      .catch((err) => {
        if (this._pending !== metadata && err.message === 'stale-result') return;
        this.properties.results = new Array(points).fill('');
        this.properties.status = 'error';
        this.properties.error = err.message || 'failed';
        updateOutputs(this, []);
        this.setDirtyCanvas(true, true);
      })
      .finally(() => {
        if (this._pending === metadata) {
          this._pending = null;
        }
      });
  };

  (ExtractPointsNode as any).prototype.onRemoved = function () {
    this._pending = null;
  };

  liteGraph.registerNodeType(NODE_TYPE, ExtractPointsNode as any);
}

function clampPoints(value: number) {
  if (Number.isNaN(value)) return DEFAULT_POINTS;
  return Math.min(MAX_POINTS, Math.max(1, Math.round(value)));
}

function parsePoints(raw: string, points: number): string[] {
  const cleaned = stripCodeFences(raw || '');
  const parsed = tryParseJson(cleaned);

  if (parsed && typeof parsed === 'object') {
    const keys = Object.keys(parsed)
      .filter((key) => key.startsWith('point'))
      .sort((a, b) => {
        const aNum = Number(a.replace(/\D+/g, ''));
        const bNum = Number(b.replace(/\D+/g, ''));
        return aNum - bNum;
      });
    const values = keys.map((key) => String((parsed as any)[key] ?? '').trim());
    if (values.length) {
      return fillSize(values, points);
    }
  }
  return fillSize([cleaned], points);
}

function buildPreviewList(values: string[]): string {
  if (!values.length) return '';
  return values
    .map((value, idx) => {
      const label = `${idx + 1}.`;
      const content = value ? value.trim() : '';
      return content ? `${label} ${content}` : `${label} …`;
    })
    .join('\n\n');
}

function fillSize(values: string[], target: number): string[] {
  const out = new Array(target).fill('');
  for (let i = 0; i < Math.min(values.length, target); i += 1) {
    out[i] = values[i];
  }
  return out;
}

function tryParseJson(source: string): any {
  try {
    return JSON.parse(source);
  } catch {
    return undefined;
  }
}

function stripCodeFences(text: string): string {
  const fenceMatch = text.match(/^```[a-zA-Z0-9]*\n([\s\S]*?)```$/);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }
  return text;
}

function updateOutputs(node: any, values: string[]) {
  const results = fillSize(values, clampPoints(node.properties.points));
  node.properties.results = results;
  results.forEach((value, idx) => {
    node.setOutputData(idx + 1, value || '');
  });
  node.setOutputData(0, results);
}
