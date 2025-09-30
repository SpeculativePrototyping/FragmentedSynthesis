import { LiteGraph as LG } from 'litegraph.js';
import { drawTextBox } from '../lib/textBox';

const NODE_TYPE = 'app/text_input';

type LiteGraphStatic = typeof LG;

export default function registerTextInput(liteGraph: LiteGraphStatic = LG) {
  const lg = liteGraph as any;
  if (lg.registered_node_types?.[NODE_TYPE]) return;

  function TextInput(this: any) {
    this.addOutput('text', 'string');
    this.properties = { value: '' };
    this.size = [260, 180];
    this._editor = null;
    this._closeEditor = null;
  }

  (TextInput as any).title = 'Text Input';
  (TextInput as any).prototype.onPropertyChanged = function (_name: string, value: string) {
    this.properties.value = value ?? '';
    this.setDirtyCanvas(true, true);
  };

  (TextInput as any).prototype.onExecute = function () {
    this.setOutputData(0, String(this.properties.value ?? ''));
  };

  const HEADER = (lg.NODE_TITLE_HEIGHT || 24) as number;
  const PADDING = 12;

  (TextInput as any).prototype.onDrawForeground = function (ctx: CanvasRenderingContext2D) {
    const areaX = PADDING;
    const areaY = HEADER + 8;
    const areaW = this.size[0] - PADDING * 2;
    const areaH = this.size[1] - areaY - PADDING;
    const text = String(this.properties.value || '');

    drawTextBox(
      ctx,
      { x: areaX, y: areaY, width: areaW, height: areaH },
      text,
      {
        background: '#fafafa',
        border: '#d0d0d0',
        focusedBackground: '#f0f6ff',
        focusedBorder: '#5991ff',
        selectedBorder: '#315efb',
        textColor: '#333',
        placeholderColor: '#888',
        placeholder: 'Type text…',
        font: '13px system-ui, sans-serif',
        padding: 10,
        lineHeight: 18,
        collapsedLines: 6,
        expandedLines: 20,
        showToggleHint: false,
      },
      {
        focused: !!this._editor,
        expanded: !!this._editor,
        selected: !!this.is_selected,
      }
    );

    ctx.save();
    ctx.fillStyle = '#555';
    ctx.font = '13px system-ui, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText('Text', 12, 10);
    ctx.restore();
  };

  (TextInput as any).prototype._openEditor = function (graphCanvas: any) {
    if (this._editor) return;
    const canvas: HTMLCanvasElement | undefined = graphCanvas?.canvas;
    if (!canvas) return;

    const ds = graphCanvas.ds;
    const rect = canvas.getBoundingClientRect();
    const areaX = this.pos[0] + PADDING;
    const areaY = this.pos[1] + HEADER + 8;
    const areaW = this.size[0] - PADDING * 2;
    const areaH = this.size[1] - (HEADER + 8) - PADDING;

    const screenX = (areaX + ds.offset[0]) * ds.scale + rect.left;
    const screenY = (areaY + ds.offset[1]) * ds.scale + rect.top;
    const screenW = areaW * ds.scale;
    const screenH = areaH * ds.scale;

    const textarea = document.createElement('textarea');
    textarea.value = this.properties.value ?? '';
    textarea.style.position = 'fixed';
    textarea.style.left = `${screenX}px`;
    textarea.style.top = `${screenY}px`;
    textarea.style.width = `${screenW}px`;
    textarea.style.height = `${screenH}px`;
    textarea.style.padding = '12px';
    textarea.style.borderRadius = '6px';
    textarea.style.border = '1px solid #5991ff';
    textarea.style.font = '13px/1.4 system-ui, sans-serif';
    textarea.style.color = '#222';
    textarea.style.background = '#fff';
    textarea.style.boxShadow = '0 8px 20px rgba(0,0,0,0.12)';
    textarea.style.resize = 'none';
    textarea.style.outline = 'none';
    textarea.style.zIndex = '10000';
    textarea.spellcheck = true;
    textarea.autocapitalize = 'off';
    textarea.autocorrect = 'off';
    textarea.setAttribute('autocomplete', 'off');
    textarea.setAttribute('data-gramm', 'false');
    textarea.setAttribute('data-enable-grammarly', 'false');
    textarea.setAttribute('data-gramm_editor', 'false');

    const close = (commit: boolean) => {
      if (!this._editor) return;
      if (commit) {
        const next = textarea.value ?? '';
        if (next !== this.properties.value) {
          this.setProperty('value', next);
        }
      }
      textarea.removeEventListener('blur', onBlur);
      textarea.removeEventListener('keydown', onKey);
      textarea.removeEventListener('pointerdown', stopBounce);
      textarea.removeEventListener('wheel', onWheel);
      textarea.remove();
      this._editor = null;
      this._closeEditor = null;
      this.setDirtyCanvas(true, true);
    };

    const onBlur = () => close(true);
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        close(false);
      } else if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 'enter') {
        ev.preventDefault();
        close(true);
      }
    };
    const stopBounce = (ev: PointerEvent) => ev.stopPropagation();
    const onWheel = (ev: WheelEvent) => {
      ev.stopPropagation();
    };

    textarea.addEventListener('blur', onBlur);
    textarea.addEventListener('keydown', onKey);
    textarea.addEventListener('pointerdown', stopBounce);
    textarea.addEventListener('wheel', onWheel, { passive: false });

    document.body.appendChild(textarea);
    textarea.focus({ preventScroll: true });
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    this._editor = textarea;
    this._closeEditor = close;
  };

  (TextInput as any).prototype.onMouseDown = function (event: MouseEvent, localPos: [number, number], graphCanvas: any) {
    const areaX = PADDING;
    const areaY = HEADER + 8;
    const areaW = this.size[0] - PADDING * 2;
    const areaH = this.size[1] - areaY - PADDING;
    if (
      localPos[0] >= areaX &&
      localPos[0] <= areaX + areaW &&
      localPos[1] >= areaY &&
      localPos[1] <= areaY + areaH
    ) {
      event.preventDefault();
      event.stopPropagation();
      this._openEditor(graphCanvas);
      return true;
    }
    return false;
  };

  (TextInput as any).prototype.onDeselected = function () {
    if (this._editor) {
      if (this._closeEditor) {
        this._closeEditor(true);
      } else {
        this._editor.blur();
      }
    }
  };

  (TextInput as any).prototype.onRemoved = function () {
    if (this._editor) {
      if (this._closeEditor) {
        this._closeEditor(false);
      } else {
        this._editor.remove();
        this._editor = null;
      }
    }
  };

  liteGraph.registerNodeType(NODE_TYPE, TextInput as any);
}
