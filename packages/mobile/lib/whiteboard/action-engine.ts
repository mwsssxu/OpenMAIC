import { whiteboardStore } from './element-store';
import { screenW, getWhiteboardLayoutMode, WHITEBOARD_CARD_GAP, WHITEBOARD_CARD_PADDING, isSmallScreen, isWideScreen } from '@/lib/utils/scaling';
import { Spacing } from '@/lib/constants/theme';

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
 * 计算白板实际可用宽度
 * 白板容器有 padding (Spacing.sm * 2)，需要减去
 */
function getWhiteboardAvailableWidth(): number {
  // WhiteboardOverlay 的 absoluteContainer 有 padding: Spacing.sm
  // 所以实际可用宽度 = 屏幕宽度 - padding * 2
  const padding = Spacing.sm ?? 8; // 默认 8px
  return screenW - padding * 2;
}

/**
 * 根据屏幕宽度计算自适应的元素位置
 * 小屏手机：垂直堆叠，单列布局
 * 大屏手机：有限的双列布局
 * iPad：保持原有水平布局
 */
function getAdaptivePosition(
  yIndex: number,
  layoutMode: 'vertical' | 'limited-horizontal' | 'horizontal',
  preferredHeight?: number,
): { x: number; y: number; width: number; height: number } {
  // 白板容器宽度（减去容器 padding）
  const containerWidth = getWhiteboardAvailableWidth();
  const margin = WHITEBOARD_CARD_GAP;
  // 元素可用宽度 = 容器宽度 - 左右边距
  const availableWidth = containerWidth - margin * 2;

  // 默认高度
  const defaultHeight = preferredHeight ?? (isSmallScreen ? 80 : isWideScreen ? 120 : 100);
  // 每个"行"的高度（考虑元素高度 + 间距）
  const rowHeight = defaultHeight + WHITEBOARD_CARD_GAP;

  if (layoutMode === 'vertical') {
    // 垂直布局：单列，宽度占满
    return {
      x: margin,
      y: yIndex * rowHeight,
      width: availableWidth,
      height: defaultHeight,
    };
  } else if (layoutMode === 'limited-horizontal') {
    // 大屏手机：双列布局
    const colWidth = (availableWidth - WHITEBOARD_CARD_GAP) / 2;
    const col = yIndex % 2;
    const row = Math.floor(yIndex / 2);
    return {
      x: margin + col * (colWidth + WHITEBOARD_CARD_GAP),
      y: row * rowHeight,
      width: colWidth,
      height: defaultHeight,
    };
  } else {
    // iPad：水平布局，最多3列
    const colCount = 3;
    const colWidth = (availableWidth - WHITEBOARD_CARD_GAP * (colCount - 1)) / colCount;
    const col = yIndex % colCount;
    const row = Math.floor(yIndex / colCount);
    return {
      x: margin + col * (colWidth + WHITEBOARD_CARD_GAP),
      y: row * rowHeight,
      width: colWidth,
      height: defaultHeight,
    };
  }
}

/**
 * 获取自适应的元素宽高（用于图表、表格等大型元素）
 */
function getAdaptiveSize(
  type: 'chart' | 'table' | 'code' | 'latex',
  layoutMode: 'vertical' | 'limited-horizontal' | 'horizontal',
  contentInfo?: { rows?: number; lines?: number },
): { width: number; height: number } {
  // 白板容器宽度（减去容器 padding）
  const containerWidth = getWhiteboardAvailableWidth();
  // 元素可用宽度 = 容器宽度 - 左右边距
  const availableWidth = containerWidth - WHITEBOARD_CARD_GAP * 2;

  if (layoutMode === 'vertical') {
    // 垂直布局：宽度占满
    switch (type) {
      case 'chart':
        return { width: availableWidth, height: isSmallScreen ? 180 : isWideScreen ? 300 : 220 };
      case 'table':
        const tableRows = contentInfo?.rows ?? 3;
        return { width: availableWidth, height: tableRows * (isSmallScreen ? 32 : isWideScreen ? 40 : 36) + 20 };
      case 'code':
        const codeLines = contentInfo?.lines ?? 10;
        return { width: availableWidth, height: codeLines * (isSmallScreen ? 16 : isWideScreen ? 20 : 18) + 40 };
      case 'latex':
        return { width: availableWidth, height: isSmallScreen ? 60 : isWideScreen ? 100 : 80 };
      default:
        return { width: availableWidth, height: 100 };
    }
  } else if (layoutMode === 'limited-horizontal') {
    // 大屏手机：宽度减半
    const colWidth = (availableWidth - WHITEBOARD_CARD_GAP) / 2;
    switch (type) {
      case 'chart':
        return { width: colWidth, height: isSmallScreen ? 180 : 220 };
      case 'table':
        return { width: colWidth, height: (contentInfo?.rows ?? 3) * 36 + 20 };
      case 'code':
        return { width: colWidth, height: (contentInfo?.lines ?? 10) * 18 + 40 };
      case 'latex':
        return { width: colWidth, height: 80 };
      default:
        return { width: colWidth, height: 100 };
    }
  } else {
    // iPad：保持原有尺寸（但宽度不超过1/3）
    const colWidth = (availableWidth - WHITEBOARD_CARD_GAP * 2) / 3;
    switch (type) {
      case 'chart':
        return { width: Math.min(400, colWidth), height: 280 };
      case 'table':
        return { width: Math.min(500, colWidth), height: (contentInfo?.rows ?? 3) * 40 + 20 };
      case 'code':
        return { width: Math.min(500, colWidth), height: 300 };
      case 'latex':
        return { width: Math.min(400, colWidth), height: 100 };
      default:
        return { width: colWidth, height: 100 };
    }
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

    // 根据屏幕宽度自适应布局
    const layoutMode = getWhiteboardLayoutMode();

    // 计算文本高度（根据内容长度估算）
    const lines = content.split('\n').length;
    const estimatedHeight = Math.max(
      isSmallScreen ? 60 : isWideScreen ? 100 : 80,
      lines * (fontSize * 1.4) + WHITEBOARD_CARD_PADDING * 2,
    );

    const adaptivePos = getAdaptivePosition(
      this.elementIndex++,
      layoutMode,
      estimatedHeight,
    );

    whiteboardStore.addElement({
      id: params.elementId || generateId('text'),
      type: 'text',
      content,
      left: adaptivePos.x,
      top: adaptivePos.y,
      width: adaptivePos.width,
      height: adaptivePos.height,
      rotate: 0,
      defaultFontName: 'Microsoft YaHei',
      defaultColor: params.color ?? '#333333',
    } as any);
  }

  private drawShape(params: Record<string, any>): void {
    const layoutMode = getWhiteboardLayoutMode();
    const adaptivePos = getAdaptivePosition(
      this.elementIndex++,
      layoutMode,
      isSmallScreen ? 100 : isWideScreen ? 160 : 130,
    );

    whiteboardStore.addElement({
      id: params.elementId || generateId('shape'),
      type: 'shape',
      viewBox: [1000, 1000] as [number, number],
      path: SHAPE_PATHS[params.shape] ?? SHAPE_PATHS.rectangle,
      left: adaptivePos.x,
      top: adaptivePos.y,
      width: Math.min(adaptivePos.width, adaptivePos.height * 1.5),
      height: adaptivePos.height,
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

    const layoutMode = getWhiteboardLayoutMode();
    const size = getAdaptiveSize('latex', layoutMode);
    const adaptivePos = getAdaptivePosition(
      this.elementIndex++,
      layoutMode,
      size.height,
    );

    whiteboardStore.addElement({
      id: params.elementId || generateId('latex'),
      type: 'latex',
      left: adaptivePos.x,
      top: adaptivePos.y,
      width: adaptivePos.width,
      height: size.height,
      rotate: 0,
      latex,
      color: params.color ?? '#000000',
    } as any);
  }

  private drawChart(params: Record<string, any>): void {
    const layoutMode = getWhiteboardLayoutMode();
    const size = getAdaptiveSize('chart', layoutMode);
    const adaptivePos = getAdaptivePosition(
      this.elementIndex++,
      layoutMode,
      size.height,
    );

    whiteboardStore.addElement({
      id: params.elementId || generateId('chart'),
      type: 'chart',
      left: adaptivePos.x,
      top: adaptivePos.y,
      width: adaptivePos.width,
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

    const layoutMode = getWhiteboardLayoutMode();
    const size = getAdaptiveSize('table', layoutMode, { rows });
    const adaptivePos = getAdaptivePosition(
      this.elementIndex++,
      layoutMode,
      size.height,
    );

    whiteboardStore.addElement({
      id: params.elementId || generateId('table'),
      type: 'table',
      left: adaptivePos.x,
      top: adaptivePos.y,
      width: adaptivePos.width,
      height: size.height,
      rotate: 0,
      colWidths,
      cellMinHeight: isSmallScreen ? 32 : isWideScreen ? 40 : 36,
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

    const layoutMode = getWhiteboardLayoutMode();
    const size = getAdaptiveSize('code', layoutMode, { lines: codeLines.length });
    const adaptivePos = getAdaptivePosition(
      this.elementIndex++,
      layoutMode,
      size.height,
    );

    whiteboardStore.addElement({
      id: params.elementId || generateId('code'),
      type: 'code',
      left: adaptivePos.x,
      top: adaptivePos.y,
      width: adaptivePos.width,
      height: size.height,
      rotate: 0,
      language: params.language ?? 'text',
      lines: codeLines,
      fileName: params.fileName,
      showLineNumbers: true,
      fontSize: isSmallScreen ? 12 : isWideScreen ? 16 : 14,
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