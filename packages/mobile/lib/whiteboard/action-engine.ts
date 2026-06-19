import { whiteboardStore } from './element-store';

// Shape SVG paths (viewBox: [1000, 1000] — same as slide shapes)
const SHAPE_PATHS: Record<string, string> = {
  rectangle: 'M 0 0 L 1000 0 L 1000 1000 L 0 1000 Z',
  circle: 'M 500 0 A 500 500 0 1 1 499 0 Z',
  triangle: 'M 500 0 L 1000 1000 L 0 1000 Z',
  rounded_rectangle: 'M 100 0 L 900 0 Q 1000 0 1000 100 L 1000 900 Q 1000 1000 900 1000 L 100 1000 Q 0 1000 0 900 L 0 100 Q 0 0 100 0 Z',
  diamond: 'M 500 0 L 1000 500 L 500 1000 L 0 500 Z',
  hexagon: 'M 250 0 L 750 0 L 1000 500 L 750 1000 L 250 1000 L 0 500 Z',
};

function generateId(type: string): string {
  return `${type}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function codeToLines(code: string): Array<{ id: string; content: string }> {
  return code.split('\n').map((content, i) => ({
    id: `L${i + 1}`,
    content,
  }));
}

export class MobileActionEngine {
  private lineIdCounter = 0;

  /** 重置布局（保留接口兼容，不再需要流式布局） */
  resetLayout(): void {
    // No-op: absolute positioning mode, no layout state to reset
  }

  /** 从现有元素重新计算（保留接口兼容） */
  private recalculateCurrentY(): void {
    // No-op: absolute positioning mode
  }

  execute(actionName: string, params: Record<string, any>): void {
    switch (actionName) {
      case 'wb_draw_text':
        this.drawText(params);
        break;
      case 'wb_draw_shape':
        this.drawShape(params);
        break;
      case 'wb_draw_line':
        this.drawLine(params);
        break;
      case 'wb_draw_latex':
        this.drawLatex(params);
        break;
      case 'wb_draw_chart':
      case 'wb_draw_bar':
      case 'wb_draw_diagram':
        this.drawChart(params);
        break;
      case 'wb_edit_code':
        this.editCode(params);
        break;
      case 'wb_draw_table':
        this.drawTable(params);
        break;
      case 'wb_draw_code':
        this.drawCode(params);
        break;
      case 'wb_clear':
        console.log('[ActionEngine] wb_clear: clearing all elements (manual)');
        whiteboardStore.clearAll();
        break;
      case 'wb_delete':
        if (params.elementId) {
          whiteboardStore.deleteElement(params.elementId);
        }
        break;
    }
  }

  private drawText(params: Record<string, any>): void {
    const fontSize = params.fontSize ?? 18;
    let content = params.content ?? '';
    if (!content) return;

    content = content
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/&amp;/g, '&')
      .replace(/&nbsp;/g, ' ');

    if (!content.startsWith('<')) {
      content = `<p style="font-size: ${fontSize}px;">${content}</p>`;
    }

    // Use LLM-provided absolute coordinates
    const left = params.x ?? 60;
    const top = params.y ?? 0;
    const width = params.width ?? 880;
    const height = params.height ?? Math.max(40, fontSize * 2);

    console.log(`[ActionEngine] drawText: left=${left}, top=${top}, w=${width}, h=${height}, fontSize=${fontSize}`);

    whiteboardStore.addElement({
      id: params.elementId || generateId('text'),
      type: 'text',
      content,
      left,
      top,
      width,
      height,
      rotate: 0,
      defaultFontName: 'Microsoft YaHei',
      defaultColor: params.color ?? '#333333',
      fill: params.fill ?? params.background,
    } as any);
  }

  private drawShape(params: Record<string, any>): void {
    const fillColor = params.fillColor ?? '#5b9bd5';
    const shapeName = params.shape ?? 'rectangle';
    const path = SHAPE_PATHS[shapeName] ?? SHAPE_PATHS.rectangle;

    const left = params.x ?? 60;
    const top = params.y ?? 0;
    // 最小尺寸保障：移动端缩放后仍可读
    const width = Math.max(params.width ?? 200, 300);
    const height = Math.max(params.height ?? 80, 100);

    // Shape has text label inside
    const label = params.label || params.text || '';
    const textConfig = label ? {
      text: {
        content: label,
        defaultFontName: 'Microsoft YaHei',
        defaultColor: params.textColor ?? '#ffffff',
        align: 'middle' as const,
      },
    } : undefined;

    // Outline (border)
    const outline = params.outline ?? (params.borderColor ? {
      style: 'solid',
      width: params.borderWidth ?? 2,
      color: params.borderColor,
    } : undefined);

    console.log(`[ActionEngine] drawShape: ${shapeName} at (${left},${top}) ${width}x${height} fill=${fillColor}`);

    whiteboardStore.addElement({
      id: params.elementId || generateId('shape'),
      type: 'shape',
      left,
      top,
      width,
      height,
      rotate: 0,
      viewBox: [1000, 1000] as [number, number],
      path,
      fixedRatio: false,
      fill: fillColor,
      outline,
      opacity: params.opacity ?? 1,
      ...textConfig,
    } as any);
  }

  private drawLine(params: Record<string, any>): void {
    const startX = params.startX ?? 0;
    const startY = params.startY ?? 0;
    const endX = params.endX ?? 100;
    const endY = params.endY ?? 100;

    // Calculate bounding box top-left
    const left = Math.min(startX, endX);
    const top = Math.min(startY, endY);

    const color = params.color ?? '#333333';
    const lineWidth = params.width ?? 2;
    const style = params.style ?? 'solid';

    // Points: ["arrow"|"dot"|"", "arrow"|"dot"|""]
    const points: [string, string] = [
      params.points?.[0] ?? '',
      params.points?.[1] ?? (params.arrow ? 'arrow' : ''),
    ];

    console.log(`[ActionEngine] drawLine: (${startX},${startY})→(${endX},${endY}) color=${color} strokeWidth=${lineWidth}`);

    whiteboardStore.addElement({
      id: params.elementId || generateId('line'),
      type: 'line',
      left,
      top,
      // width = 线条粗细（stroke thickness），NOT bounding box width
      // bounding box 由 start/end 坐标定义，LineElement 自行计算
      width: lineWidth,
      start: [startX - left, startY - top] as [number, number],
      end: [endX - left, endY - top] as [number, number],
      style,
      color,
      points,
    } as any);
  }

  private drawLatex(params: Record<string, any>): void {
    const latex = params.latex ?? params.content ?? '';
    if (!latex) return;

    const left = params.x ?? 60;
    const top = params.y ?? 0;
    const width = params.width ?? 880;
    const height = params.height ?? 60;

    console.log(`[ActionEngine] drawLatex: at (${left},${top}) ${width}x${height}`);

    whiteboardStore.addElement({
      id: params.elementId || generateId('latex'),
      type: 'latex',
      left,
      top,
      width,
      height,
      rotate: 0,
      latex,
      color: params.color ?? '#000000',
    } as any);
  }

  private drawChart(params: Record<string, any>): void {
    const left = params.x ?? 60;
    const top = params.y ?? 0;
    const width = params.width ?? 880;
    const height = params.height ?? 200;

    whiteboardStore.addElement({
      id: params.elementId || generateId('chart'),
      type: 'chart',
      left,
      top,
      width,
      height,
      rotate: 0,
      chartType: params.chartType ?? 'bar',
      data: params.data ?? {},
      themeColors: params.themeColors ?? ['#5b9bd5', '#ed7d31', '#a5a5a5', '#ffc000', '#4472c4'],
    } as any);
  }

  private drawTable(params: Record<string, any>): void {
    const rawRows = params.data as string[][] | undefined;
    if (!rawRows || rawRows.length === 0) return;

    const rows = rawRows.length;
    const cols = rawRows[0]?.length ?? 0;
    if (cols === 0) return;

    const colWidths = Array(cols).fill(1 / cols);
    let cellId = 0;
    const tableData = rawRows.map((row) =>
      row.map((text) => ({
        id: `cell_${cellId++}`,
        colspan: 1,
        rowspan: 1,
        text: String(text),
      })),
    );

    const left = params.x ?? 60;
    const top = params.y ?? 0;
    const width = params.width ?? 880;
    const height = params.height ?? rows * 30 + 20;

    whiteboardStore.addElement({
      id: params.elementId || generateId('table'),
      type: 'table',
      left,
      top,
      width,
      height,
      rotate: 0,
      colWidths,
      cellMinHeight: 30,
      data: tableData,
      outline: params.outline ?? { width: 2, style: 'solid', color: '#eeece1' },
      theme: params.theme
        ? { color: params.theme.color, rowHeader: true, rowFooter: false, colHeader: false, colFooter: false }
        : undefined,
    } as any);
  }

  private drawCode(params: Record<string, any>): void {
    const code = params.code ?? params.content ?? '';
    if (!code) return;

    const codeLines = codeToLines(code);

    const left = params.x ?? 60;
    const top = params.y ?? 0;
    const width = params.width ?? 880;
    const height = params.height ?? codeLines.length * 15 + 40;

    whiteboardStore.addElement({
      id: params.elementId || generateId('code'),
      type: 'code',
      left,
      top,
      width,
      height,
      rotate: 0,
      language: params.language ?? 'text',
      lines: codeLines,
      fileName: params.fileName,
      showLineNumbers: true,
      fontSize: 14,
    } as any);
  }

  private editCode(params: Record<string, any>): void {
    const elementId = params.elementId;
    if (!elementId) return;

    const elements = whiteboardStore.getElements();
    const element = elements.find((el) => el.id === elementId);
    if (!element || element.type !== 'code') return;

    const codeEl = element as any;
    const newLines = [...codeEl.lines];
    const operations: Array<{ operation: string; lineId?: string; lineIds?: string[]; content?: string }> = params.operations ?? [];

    for (const op of operations) {
      if (op.operation === 'insert_after' && op.lineId) {
        const idx = newLines.findIndex((l: any) => l.id === op.lineId);
        if (idx === -1) continue;
        const newContent = (op.content ?? '').split('\n');
        const insertLines = newContent.map((c, i) => ({
          id: `L_${++this.lineIdCounter}_${Date.now().toString(36)}_${i}`,
          content: c,
        }));
        newLines.splice(idx + 1, 0, ...insertLines);
      } else if (op.operation === 'insert_before' && op.lineId) {
        const idx = newLines.findIndex((l: any) => l.id === op.lineId);
        if (idx === -1) continue;
        const newContent = (op.content ?? '').split('\n');
        const insertLines = newContent.map((c, i) => ({
          id: `L_${++this.lineIdCounter}_${Date.now().toString(36)}_${i}`,
          content: c,
        }));
        newLines.splice(idx, 0, ...insertLines);
      } else if (op.operation === 'delete_lines' && op.lineIds) {
        const idsToDelete = new Set(op.lineIds);
        for (let i = newLines.length - 1; i >= 0; i--) {
          if (idsToDelete.has(newLines[i].id)) newLines.splice(i, 1);
        }
      } else if (op.operation === 'replace_lines' && op.lineIds) {
        const firstIdx = newLines.findIndex((l: any) => l.id === op.lineIds![0]);
        if (firstIdx === -1) continue;
        const lastIdx = newLines.findIndex((l: any) => l.id === op.lineIds![op.lineIds!.length - 1]);
        const newContent = (op.content ?? '').split('\n');
        const replaceLines = newContent.map((c, i) => ({
          id: i < op.lineIds!.length ? op.lineIds![i] : `L_${++this.lineIdCounter}_${Date.now().toString(36)}_${i}`,
          content: c,
        }));
        newLines.splice(firstIdx, lastIdx - firstIdx + 1, ...replaceLines);
      }
    }

    whiteboardStore.updateElement(elementId, { lines: newLines });
  }
}

export const mobileActionEngine = new MobileActionEngine();
