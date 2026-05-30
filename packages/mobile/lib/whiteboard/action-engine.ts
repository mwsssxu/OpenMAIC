import { whiteboardStore } from './element-store';
import { WHITEBOARD_CARD_GAP, WHITEBOARD_CARD_PADDING } from '@/lib/utils/scaling';

// 白板基准画布尺寸（与 ScreenCanvas.tsx 保持一致）
const WHITEBOARD_CANVAS_WIDTH = 1000;

const SHAPE_PATHS: Record<string, string> = {
  rectangle: 'M 0 0 L 1000 0 L 1000 1000 L 0 1000 Z',
  circle: 'M 500 0 A 500 500 0 1 1 499 0 Z',
  triangle: 'M 500 0 L 1000 1000 L 0 1000 Z',
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

/**
 * 根据白板基准画布计算元素位置
 * 使用 1000px 基准宽度，ScreenCanvas 会自动缩放
 * 垂直排列：从上至下，宽度占满
 */
function getWhiteboardPosition(
  yIndex: number,
  preferredHeight?: number,
): { x: number; y: number; width: number; height: number } {
  const margin = WHITEBOARD_CARD_GAP;
  // 基准画布上的可用宽度（1000px - 边距）
  const availableWidth = WHITEBOARD_CANVAS_WIDTH - margin * 2;

  // 默认高度（基准画布上的高度）
  const defaultHeight = preferredHeight ?? 80;
  // 每个"行"的高度（考虑元素高度 + 间距）
  const rowHeight = defaultHeight + WHITEBOARD_CARD_GAP;

  // 垂直布局：单列，从上至下排列
  return {
    x: margin,
    y: yIndex * rowHeight,
    width: availableWidth,
    height: defaultHeight,
  };
}

/**
 * 获取白板元素的基准尺寸（用于图表、表格等大型元素）
 */
function getWhiteboardSize(
  type: 'chart' | 'table' | 'code' | 'latex',
  contentInfo?: { rows?: number; lines?: number },
): { width: number; height: number } {
  const availableWidth = WHITEBOARD_CANVAS_WIDTH - WHITEBOARD_CARD_GAP * 2;

  switch (type) {
    case 'chart':
      return { width: availableWidth, height: 200 };
    case 'table':
      const tableRows = contentInfo?.rows ?? 3;
      return { width: availableWidth, height: tableRows * 30 + 20 };
    case 'code':
      const codeLines = contentInfo?.lines ?? 10;
      return { width: availableWidth, height: codeLines * 15 + 40 };
    case 'latex':
      return { width: availableWidth, height: 60 };
    default:
      return { width: availableWidth, height: 80 };
  }
}

export class MobileActionEngine {
  private lineIdCounter = 0;
  private elementIndex = 0; // 用于自适应布局的计数器

  /** 重置元素计数器（用于新白板内容） */
  resetLayout(): void {
    this.elementIndex = 0;
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
        whiteboardStore.clear();
        this.elementIndex = 0; // 清空时重置计数器
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

    // 计算文本高度（基准画布上的高度）
    const lines = content.split('\n').length;
    const estimatedHeight = Math.max(60, lines * 25 + WHITEBOARD_CARD_PADDING);

    const pos = getWhiteboardPosition(
      this.elementIndex++,
      estimatedHeight,
    );

    whiteboardStore.addElement({
      id: params.elementId || generateId('text'),
      type: 'text',
      content,
      left: pos.x,
      top: pos.y,
      width: pos.width,
      height: pos.height,
      rotate: 0,
      defaultFontName: 'Microsoft YaHei',
      defaultColor: params.color ?? '#333333',
    } as any);
  }

  private drawShape(params: Record<string, any>): void {
    const pos = getWhiteboardPosition(
      this.elementIndex++,
      100,
    );

    whiteboardStore.addElement({
      id: params.elementId || generateId('shape'),
      type: 'shape',
      viewBox: [1000, 1000] as [number, number],
      path: SHAPE_PATHS[params.shape] ?? SHAPE_PATHS.rectangle,
      left: pos.x,
      top: pos.y,
      width: Math.min(pos.width, pos.height * 1.5),
      height: pos.height,
      rotate: 0,
      fill: params.fillColor ?? '#5b9bd5',
      fixedRatio: false,
    } as any);
  }

  private drawLine(params: Record<string, any>): void {
    // 线条保持原有坐标（通常用于连接元素）
    const left = Math.min(params.startX ?? 0, params.endX ?? 100);
    const top = Math.min(params.startY ?? 0, params.endY ?? 100);
    const start: [number, number] = [(params.startX ?? 0) - left, (params.startY ?? 0) - top];
    const end: [number, number] = [(params.endX ?? 100) - left, (params.endY ?? 100) - top];

    whiteboardStore.addElement({
      id: params.elementId || generateId('line'),
      type: 'line',
      left,
      top,
      width: params.width ?? 2,
      start,
      end,
      style: params.style ?? 'solid',
      color: params.color ?? '#333333',
      points: params.points ?? ['', ''],
    } as any);
  }

  private drawLatex(params: Record<string, any>): void {
    const latex = params.latex ?? params.content ?? '';
    if (!latex) return;

    const size = getWhiteboardSize('latex');
    const pos = getWhiteboardPosition(
      this.elementIndex++,
      size.height,
    );

    whiteboardStore.addElement({
      id: params.elementId || generateId('latex'),
      type: 'latex',
      left: pos.x,
      top: pos.y,
      width: pos.width,
      height: size.height,
      rotate: 0,
      latex,
      color: params.color ?? '#000000',
    } as any);
  }

  private drawChart(params: Record<string, any>): void {
    const size = getWhiteboardSize('chart');
    const pos = getWhiteboardPosition(
      this.elementIndex++,
      size.height,
    );

    whiteboardStore.addElement({
      id: params.elementId || generateId('chart'),
      type: 'chart',
      left: pos.x,
      top: pos.y,
      width: pos.width,
      height: size.height,
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

    const size = getWhiteboardSize('table', { rows });
    const pos = getWhiteboardPosition(
      this.elementIndex++,
      size.height,
    );

    whiteboardStore.addElement({
      id: params.elementId || generateId('table'),
      type: 'table',
      left: pos.x,
      top: pos.y,
      width: pos.width,
      height: size.height,
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

    const size = getWhiteboardSize('code', { lines: codeLines.length });
    const pos = getWhiteboardPosition(
      this.elementIndex++,
      size.height,
    );

    whiteboardStore.addElement({
      id: params.elementId || generateId('code'),
      type: 'code',
      left: pos.x,
      top: pos.y,
      width: pos.width,
      height: size.height,
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