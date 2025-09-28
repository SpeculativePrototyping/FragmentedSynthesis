type WidgetOptions = {
  placeholder?: string;
  spellcheck?: boolean;
  grammarly?: boolean;
  minHeight?: number;
  maxHeight?: number;
  className?: string;
};

type MultilineWidgetValue = string;

type WidgetContext = {
  node: any;
  property?: string;
  input_height?: number;
};

const DEFAULT_OPTIONS: Required<Pick<WidgetOptions, 'spellcheck' | 'grammarly' | 'minHeight' | 'maxHeight'>> = {
  spellcheck: true,
  grammarly: false,
  minHeight: 80,
  maxHeight: 320,
};

export function registerMultilineWidget(lg?: any) {
  const registry = lg ?? (globalThis as any).LiteGraph;
  const widgets = registry.MultiWidgets || registry.Widgets;
  if (!widgets) return;
  if (widgets.multiline) return;

  widgets.multiline = {
    name: 'multiline',
    serialize: true,
    value: '' as MultilineWidgetValue,
    draw(node: any, ctx: CanvasRenderingContext2D, _width: number, y: number, widget: any) {
      const margin = 6;
      const width = node.size[0] - margin * 2;
      const height = widget.last_height || DEFAULT_OPTIONS.minHeight;
      ctx.save();
      ctx.fillStyle = '#fafafa';
      ctx.strokeStyle = '#d0d0d0';
      ctx.lineWidth = 1;
      if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(margin, y, width, height, 6);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillRect(margin, y, width, height);
        ctx.strokeRect(margin, y, width, height);
      }

      ctx.font = '12px system-ui, sans-serif';
      ctx.fillStyle = '#444';
      ctx.textBaseline = 'top';

      const text = widget.value || '';
      const display = text || widget.options?.placeholder || '';
      const lines = display.split('\n');
      const lineHeight = 16;
      const padding = 10;
      const maxLines = Math.floor((height - padding * 2) / lineHeight);

      for (let i = 0; i < Math.min(lines.length, maxLines); i += 1) {
        ctx.fillText(lines[i], margin + padding, y + padding + i * lineHeight, width - padding * 2);
      }
      ctx.restore();
      return height + margin;
    },
    mouse(event: MouseEvent, _pos: [number, number], node: any, widget: any) {
      if (event.type !== 'mousedown') return;
      openEditor(node, widget, event);
      event.stopPropagation();
      event.preventDefault();
      return true;
    },
    computeSize(node: any, widget: any) {
      const height = Math.max(DEFAULT_OPTIONS.minHeight, widget.last_height || DEFAULT_OPTIONS.minHeight);
      return [node.size[0], height + 8];
    },
  };
}

function openEditor(node: any, widget: any, event: MouseEvent) {
  const canvas = node.graph?.canvas?.canvas as HTMLCanvasElement | undefined;
  if (!canvas) return;

  const options: WidgetOptions = {
    ...DEFAULT_OPTIONS,
    ...(widget.options || {}),
  };

  const rect = canvas.getBoundingClientRect();
  const ds = node.graph.canvas.ds;
  const x = node.pos[0] + 6;
  const y = (widget.y != null ? node.pos[1] + widget.y : node.pos[1]) + 6;
  const width = node.size[0] - 12;
  const height = Math.min(options.maxHeight, Math.max(options.minHeight, widget.last_height || options.minHeight));

  const screenX = (x + ds.offset[0]) * ds.scale + rect.left;
  const screenY = (y + ds.offset[1]) * ds.scale + rect.top;
  const screenW = width * ds.scale;
  const screenH = height * ds.scale;

  const textarea = document.createElement('textarea');
  textarea.value = widget.value ?? '';
  textarea.style.position = 'fixed';
  textarea.style.left = `${screenX}px`;
  textarea.style.top = `${screenY}px`;
  textarea.style.width = `${screenW}px`;
  textarea.style.height = `${screenH}px`;
  textarea.style.padding = '10px';
  textarea.style.borderRadius = '6px';
  textarea.style.border = '1px solid #5080ff';
  textarea.style.background = '#fff';
  textarea.style.boxShadow = '0 10px 24px rgba(0,0,0,0.18)';
  textarea.style.font = '13px/1.45 system-ui, sans-serif';
  textarea.style.color = '#222';
  textarea.style.resize = 'vertical';
  textarea.style.minHeight = `${options.minHeight}px`;
  textarea.style.maxHeight = `${options.maxHeight}px`;
  textarea.style.zIndex = '10000';
  textarea.spellcheck = options.spellcheck ?? DEFAULT_OPTIONS.spellcheck;
  textarea.autocapitalize = 'off';
  textarea.autocorrect = 'off';
  textarea.setAttribute('autocomplete', 'off');
  textarea.setAttribute('data-enable-grammarly', options.grammarly ? 'true' : 'false');
  textarea.setAttribute('data-gramm', options.grammarly ? 'true' : 'false');
  textarea.setAttribute('data-gramm_editor', options.grammarly ? 'true' : 'false');

  const close = (commit: boolean) => {
    if (!textarea.isConnected) return;
    if (commit) {
      const next = textarea.value ?? '';
      widget.value = next;
      widget.callback?.(next, widget, node, <WidgetContext>{ node });
      widget.last_height = Math.min(options.maxHeight, Math.max(options.minHeight, textarea.offsetHeight));
    }
    textarea.removeEventListener('blur', onBlur);
    textarea.removeEventListener('keydown', onKey);
    textarea.removeEventListener('wheel', onWheel);
    textarea.removeEventListener('pointerdown', stopPropagation);
    textarea.remove();
    node.setDirtyCanvas(true, true);
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
  const onWheel = (ev: WheelEvent) => ev.stopPropagation();
  const stopPropagation = (ev: PointerEvent) => ev.stopPropagation();

  textarea.addEventListener('blur', onBlur);
  textarea.addEventListener('keydown', onKey);
  textarea.addEventListener('wheel', onWheel, { passive: false });
  textarea.addEventListener('pointerdown', stopPropagation);

  document.body.appendChild(textarea);
  textarea.focus({ preventScroll: true });
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);
}
