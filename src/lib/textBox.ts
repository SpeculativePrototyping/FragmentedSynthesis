export interface TextBoxRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TextBoxOptions {
  padding?: number;
  radius?: number;
  background?: string;
  border?: string;
  focusedBackground?: string;
  focusedBorder?: string;
  selectedBorder?: string;
  textColor?: string;
  placeholderColor?: string;
  font?: string;
  lineHeight?: number;
  placeholder?: string;
  collapsedLines?: number;
  expandedLines?: number;
  fadeColor?: string;
  showToggleHint?: boolean;
}

export interface TextBoxState {
  focused?: boolean;
  expanded?: boolean;
  selected?: boolean;
}

interface WrapResult {
  lines: string[];
  truncated: boolean;
}

export interface TextBoxDrawResult {
  truncated: boolean;
  displayedLines: number;
}

export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): WrapResult {
  const lines: string[] = [];
  let overflow = false;
  const append = (line: string) => {
    if (lines.length < maxLines) {
      lines.push(line);
    } else {
      overflow = true;
    }
  };

  const pushChunk = (chunk: string) => {
    if (chunk === '' && lines.length === 0) {
      append('');
      return;
    }
    let remaining = chunk;
    while (remaining.length > 0) {
      if (ctx.measureText(remaining).width <= maxWidth) {
        append(remaining);
        break;
      }
      let low = 0;
      let high = remaining.length;
      while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        const sample = remaining.slice(0, mid);
        const fits = ctx.measureText(sample).width <= maxWidth;
        if (fits) {
          low = mid;
        } else {
          high = mid - 1;
        }
      }
      let sliceLen = Math.max(1, low);
      if (sliceLen < remaining.length) {
        const slice = remaining.slice(0, sliceLen);
        const lastSpace = slice.lastIndexOf(' ');
        if (lastSpace > 0) {
          sliceLen = lastSpace + 1;
        }
      }
      const piece = remaining.slice(0, sliceLen).trimEnd();
      if (piece) {
        append(piece);
      }
      remaining = remaining.slice(sliceLen).replace(/^\s+/, '');
      if (lines.length >= maxLines) break;
    }
  };

  if (!text) {
    append('');
  } else {
    text.split('\n').forEach((line) => {
      if (lines.length >= maxLines) return;
      pushChunk(line);
    });
  }

  let truncated = overflow;
  if (overflow && lines.length === maxLines) {
    const ellipsis = '…';
    const idx = maxLines - 1;
    let last = lines[idx] ?? '';
    if (last) {
      while (last.length && ctx.measureText(last + ellipsis).width > maxWidth) {
        last = last.slice(0, -1);
      }
      lines[idx] = `${last}${ellipsis}`;
      truncated = true;
    } else if (ellipsis) {
      lines[idx] = ellipsis;
      truncated = true;
    }
  }

  return { lines, truncated };
}

export function drawTextBox(
  ctx: CanvasRenderingContext2D,
  rect: TextBoxRect,
  text: string,
  options: TextBoxOptions = {},
  state: TextBoxState = {}
): TextBoxDrawResult {
  const {
    padding = 12,
    radius = 6,
    background = '#fafafa',
    border = '#d0d0d0',
    focusedBackground = '#f0f6ff',
    focusedBorder = '#5991ff',
    selectedBorder = '#315efb',
    textColor = '#333',
    placeholderColor = '#888',
    font = '13px system-ui, sans-serif',
    lineHeight = 18,
    placeholder = 'Type text…',
    collapsedLines = 3,
    expandedLines,
    fadeColor = 'rgba(240, 240, 240, 0.85)',
    showToggleHint = false,
  } = options;

  const { focused = false, expanded = false, selected = false } = state;

  const innerX = rect.x;
  const innerY = rect.y;
  const innerWidth = rect.width;
  const innerHeight = rect.height;

  ctx.save();
  ctx.fillStyle = focused ? focusedBackground : background;
  ctx.strokeStyle = focused ? focusedBorder : selected ? selectedBorder : border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (typeof (ctx as any).roundRect === 'function') {
    (ctx as any).roundRect(innerX, innerY, innerWidth, innerHeight, radius);
  } else {
    ctx.rect(innerX, innerY, innerWidth, innerHeight);
  }
  ctx.fill();
  ctx.stroke();

  ctx.font = font;
  ctx.textBaseline = 'top';

  const contentWidth = innerWidth - padding * 2;
  const contentHeight = innerHeight - padding * 2;
  const maxLinesRaw = Math.max(1, Math.floor(contentHeight / lineHeight));
  const collapsedMax = Math.max(1, Math.min(collapsedLines, maxLinesRaw));
  const expandedMax = expandedLines ? Math.max(1, Math.min(expandedLines, maxLinesRaw)) : maxLinesRaw;
  const maxLines = expanded ? expandedMax : collapsedMax;

  const displayText = text && text.length > 0 ? text : '';
  const placeholderText = text && text.length > 0 ? '' : placeholder;

  const { lines, truncated } = wrapText(ctx, displayText || placeholderText, contentWidth, maxLines);

  ctx.fillStyle = displayText ? textColor : placeholderColor;
  lines.forEach((line, idx) => {
    const offsetY = innerY + padding + idx * lineHeight;
    if (offsetY > innerY + innerHeight - padding) return;
    ctx.fillText(line, innerX + padding, offsetY, contentWidth);
  });

  if (truncated && !expanded) {
    const gradient = ctx.createLinearGradient(0, innerY + innerHeight - padding * 1.5, 0, innerY + innerHeight);
    gradient.addColorStop(0, 'rgba(250,250,250,0)');
    gradient.addColorStop(1, fadeColor);
    ctx.fillStyle = gradient;
    ctx.fillRect(innerX + 1, innerY + innerHeight - padding * 1.5, innerWidth - 2, padding * 1.5);
  }

  if (showToggleHint && truncated) {
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#666';
    const hint = expanded ? 'Collapse' : 'Expand';
    ctx.fillText(hint, innerX + innerWidth - 8, innerY + innerHeight - 6);
  }

  ctx.restore();

  return {
    truncated,
    displayedLines: lines.length,
  };
}
