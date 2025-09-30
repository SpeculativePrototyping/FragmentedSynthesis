import { LiteGraph as LG } from 'litegraph.js';
import { drawTextBox } from '../lib/textBox';
import { enqueueLlmJob, type LlmResult } from '../lib/llmQueue';
import { drawStatusPanel } from './utils/visuals';

type LiteGraphStatic = typeof LG;

const NODE_TYPE = 'app/summarize';
const LENGTH_OPTIONS = ['1 sentence', '2 sentences', '3 sentences', '1-2 sentences', 'Short paragraph'];
const DEFAULT_LENGTH = '1-2 sentences';
const BASE_PROMPT =
  "You are a concise academic assistant. Summarize the user's text in {length}. Output only LaTeX-safe prose (no environments), suitable for inclusion in a paragraph. Respond strictly with JSON containing a single string property named 'summary'.";

const RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'summary_response',
    schema: {
      type: 'object',
      properties: {
        summary: { type: 'string' }
      },
      required: ['summary'],
      additionalProperties: false
    }
  }
};

export default function registerSummarize(liteGraph: LiteGraphStatic = LG) {
  const lg = liteGraph as any;
  if (lg.registered_node_types?.[NODE_TYPE]) return;

  function SummarizeNode(this: any) {
    this.addInput('text', 'string');
    this.addOutput('summary', 'string');

    this.properties = {
      length: DEFAULT_LENGTH,
      summary: '',
      status: 'idle',
      error: '',
      expanded: false,
    };

    this.size = [340, 260];
    this.widgets_start_y = this.size[1] - 72;
    this._lastInput = '';
    this._requestId = 0;
    this.serialize_widgets = true;

    const lengthWidget = this.addWidget(
      'combo',
      'Length',
      this.properties.length,
      (value: string) => {
        this.properties.length = value;
        this.queueSummary(true);
      },
      { values: LENGTH_OPTIONS }
    );
    if (lengthWidget) lengthWidget.serialize = true;

    this.addWidget('toggle', 'Expanded', this.properties.expanded, (value: boolean) => {
      this.properties.expanded = !!value;
      this.setDirtyCanvas(true, true);
      return !!value;
    });

    this.addWidget('button', 'Retry', 'Summarize', () => {
      this.queueSummary(true);
      return false;
    });
  }

  (SummarizeNode as any).title = 'Summarize';

  (SummarizeNode as any).prototype.onExecute = function () {
    const incoming = this.getInputData(0);
    const text = typeof incoming === 'string' ? incoming : '';

    if (text !== this._lastInput) {
      this._lastInput = text;
      this.queueSummary(false);
    }

    const out = this.properties.summary || '';
    this.setOutputData(0, out);
  };

  (SummarizeNode as any).prototype.onDrawForeground = function (ctx: CanvasRenderingContext2D) {
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

    drawTextBox(
      ctx,
      { x: areaX, y: areaY, width: areaW, height: areaH },
      this.properties.summary,
      {
        background: '#f7f7f7',
        border: '#d0d0d0',
        focusedBackground: '#eef7ff',
        focusedBorder: '#88aaff',
        selectedBorder: '#315efb',
        textColor: '#222',
        placeholder: this.properties.status === 'idle' ? 'Summary will appear here…' : '',
        padding: 10,
        lineHeight: 18,
        font: '13px system-ui, sans-serif',
        collapsedLines: 4,
        expandedLines: 14,
        showToggleHint: true,
      },
      {
        focused: !!this._editor,
        expanded: !!this.properties.expanded || !!this.is_selected,
        selected: !!this.is_selected,
      }
    );
  };

  (SummarizeNode as any).prototype.queueSummary = function (force: boolean) {
    const text = (this._lastInput || '').trim();
    if (!text) {
      this._pending = null;
      this._requestId += 1;
      this.properties.summary = '';
      this.properties.status = 'idle';
      this.properties.error = '';
      this.setOutputData(0, '');
      this.setDirtyCanvas(true, true);
      return;
    }

    if (!force && this._pending && this._pending.text === text && this._pending.length === this.properties.length) {
      return;
    }

    const requestId = ++this._requestId;
    this.properties.status = 'queued…';
    this.properties.error = '';
    this.properties.summary = '';
    this.setOutputData(0, '');
    this.setDirtyCanvas(true, true);

    const sysPrompt = BASE_PROMPT.replace('{length}', this.properties.length);
    const userPrompt = buildUserPrompt(text, this.properties.length);

    const pending = {
      text,
      length: this.properties.length,
      requestId
    };
    this._pending = pending;

    enqueueLlmJob({
      user: userPrompt,
      sys: sysPrompt,
      responseFormat: RESPONSE_FORMAT,
      onStart: () => {
        if (!this._pending || this._pending.requestId !== requestId) return;
        this.properties.status = 'processing…';
        this.setDirtyCanvas(true, true);
      }
    })
      .then((result: LlmResult) => {
        if (!this._pending || this._pending.requestId !== requestId) return;
        const summary = extractSummary(result);
        this.properties.summary = summary;
        this.properties.status = summary ? 'done' : 'done (empty)';
        this.setOutputData(0, summary);
        this.setDirtyCanvas(true, true);
      })
      .catch((err: Error) => {
        if (!this._pending || this._pending.requestId !== requestId) return;
        this.properties.summary = '';
        this.properties.status = 'error';
        this.properties.error = err.message || 'failed';
        this.setOutputData(0, '');
        this.setDirtyCanvas(true, true);
      })
      .finally(() => {
        if (this._pending && this._pending.requestId === requestId) {
          this._pending = null;
        }
      });
  };

  (SummarizeNode as any).prototype.onRemoved = function () {
    this._pending = null;
  };

  liteGraph.registerNodeType(NODE_TYPE, SummarizeNode as any);
}

function buildUserPrompt(text: string, length: string): string {
  return `Summarize the following text.\n\nDesired length: ${length}.\n\nText:\n${text}`;
}

function extractSummary(result: LlmResult): string {
  const raw = (result.message || '').trim();
  if (!raw) return '';

  const cleaned = stripCodeFences(raw);
  const parsed = tryParseJson(cleaned);
  if (parsed && typeof parsed.summary === 'string') {
    return parsed.summary.trim();
  }

  if (parsed && parsed.result && typeof parsed.result.summary === 'string') {
    return parsed.result.summary.trim();
  }

  const message = result.response?.choices?.[0]?.message;
  const parsedSummary = message?.parsed?.summary;
  if (typeof parsedSummary === 'string') {
    return parsedSummary.trim();
  }

  return cleaned;
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
