export interface StatusPanelOptions {
  ctx: CanvasRenderingContext2D;
  width: number;
  top: number;
  status: string;
  error?: string;
}

export function drawStatusPanel({ ctx, width, top, status, error }: StatusPanelOptions) {
  const lines = [status || 'Status: idle'];
  if (error) {
    lines.push(`Error: ${error}`);
  }

  ctx.save();
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const centerX = width / 2;
  const lineHeight = 16;
  const boxWidth = Math.max(
    140,
    ...lines.map((line) => ctx.measureText(line).width + 24)
  );
  const boxHeight = lineHeight * lines.length + 8;
  const boxX = centerX - boxWidth / 2;
  const boxY = top - 4;

  ctx.fillStyle = 'rgba(22, 24, 35, 0.85)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 6);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
    ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
  }

  lines.forEach((line, idx) => {
    ctx.fillStyle = idx === 0 ? '#f5f7ff' : '#ffb3b8';
    ctx.fillText(line, centerX, top + idx * lineHeight);
  });

  ctx.restore();
}

export interface InputPreviewItem {
  label: string;
  value: string;
}

export interface InputPreviewOptions {
  ctx: CanvasRenderingContext2D;
  title?: string;
  items: InputPreviewItem[];
  x: number;
  y: number;
  lineHeight?: number;
  titleColor?: string;
  textColor?: string;
}

export function drawInputPreviewList({
  ctx,
  title,
  items,
  x,
  y,
  lineHeight = 16,
  titleColor = '#9da7c0',
  textColor = '#cdd5ec',
}: InputPreviewOptions) {
  ctx.save();
  ctx.font = '12px system-ui, sans-serif';
  ctx.textBaseline = 'top';
  let cursorY = y;

  if (title) {
    ctx.fillStyle = titleColor;
    ctx.fillText(title, x, cursorY);
    cursorY += lineHeight;
  }

  ctx.fillStyle = textColor;
  items.forEach((item) => {
    const label = item.label ? `${item.label}: ` : '';
    ctx.fillText(`${label}${item.value}`, x, cursorY);
    cursorY += lineHeight;
  });

  ctx.restore();
}
