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

  /** 画布尺寸（LLM 坐标系）— 高度不限，支持滚动 */
  private static readonly CANVAS_W = 1000;
  private static readonly CANVAS_H = 5000; // 实际高度由内容决定，ScrollView 自动滚动

  /**
   * 钳制元素坐标到画布边界内
   * 如果 left+width 超出画布右边界，将 left 左移使其完全可见
   * 如果 top+height 超出画布下边界，将 top 上移
   */
  private clampToCanvas(left: number, top: number, width: number, height: number): { left: number; top: number; width: number; height: number } {
    const cw = MobileActionEngine.CANVAS_W;
    // 限制 width 不超过画布宽度
    const w = Math.min(width, cw);
    const h = height;
    // 如果右侧溢出，左移
    const l = Math.max(0, Math.min(left, cw - w));
    // Y: 无上限——内容可向下无限扩展，ScrollView 自动滚动
    const t = Math.max(0, top);
    return { left: l, top: t, width: w, height: h };
  }

  /** 每页最大元素数量（滚动模式下放宽，仅作安全上限） */
  private static readonly MAX_ELEMENTS_PER_PAGE = 20;

  /**
   * 碰撞检测：检查新元素是否与已有元素重叠，如果重叠则下推
   * - 检查所有类型组合（text-text, text-shape, shape-shape）
   * - 跳过：text 完全在大型背景 shape 内（正常背景叠加）
   * - 跳过：line 与任何元素（线条交叉是正常的）
   */
  private resolveCollision(
    left: number,
    top: number,
    width: number,
    height: number,
    type: string,
  ): { left: number; top: number } {
    const elements = whiteboardStore.getElements();
    if (elements.length === 0) return { left, top };

    const MIN_OVERLAP = 10; // X/Y 双轴重叠阈值
    const GAP = 25; // 元素间最小垂直间距（增大以改善视觉呼吸感）
    const MAX_PASSES = 8; // 多趟迭代：处理级联碰撞（下推后可能与已检查元素重叠）

    let adjustedTop = top;

    for (let pass = 0; pass < MAX_PASSES; pass++) {
      let changed = false;

      for (const el of elements) {
        const elType = (el as any).type ?? 'text';

        // line 类型跳过（线条交叉是正常的）
        if (elType === 'line' || type === 'line') continue;

        const elLeft = (el as any).left ?? 0;
        const elTop = (el as any).top ?? 0;
        const elWidth = (el as any).width ?? 100;
        const elHeight = (el as any).height ?? 50;

        // 跳过：text 完全在大型背景 shape 内（背景容器场景）
        // FIX: 用 adjustedTop 替代原始 top——下推后包含关系会变化
        const isFullyContained = left >= elLeft && adjustedTop >= elTop &&
          left + width <= elLeft + elWidth && adjustedTop + height <= elTop + elHeight;
        const shapeMuchLarger = elWidth > width * 1.5 && elHeight > height * 1.5;
        if (isFullyContained && shapeMuchLarger && elType === 'shape') continue;

        // 跳过：新 shape 是已有 text 的背景（先画文字后补色块）
        const reverseContained = elLeft >= left && elTop >= adjustedTop &&
          elLeft + elWidth <= left + width && elTop + elHeight <= adjustedTop + height;
        const newShapeMuchLarger = width > elWidth * 1.5 && height > elHeight * 1.5;
        if (reverseContained && newShapeMuchLarger && type === 'shape') continue;

        const overlapX = Math.min(left + width, elLeft + elWidth) - Math.max(left, elLeft);
        const overlapY = Math.min(adjustedTop + height, elTop + elHeight) - Math.max(adjustedTop, elTop);

        if (overlapX > MIN_OVERLAP && overlapY > MIN_OVERLAP) {
          // 下推到该元素下方
          const newTop = elTop + elHeight + GAP;
          if (newTop > adjustedTop) {
            console.log(`[ActionEngine] collision (pass ${pass}): ${type} overlapped ${elType} (overlapX=${overlapX.toFixed(0)}, overlapY=${overlapY.toFixed(0)}), pushing top ${adjustedTop}→${newTop}`);
            adjustedTop = newTop;
            changed = true;
          }
        }
      }

      // 收敛：没有新的碰撞则退出
      if (!changed) break;
    }

    return { left, top: adjustedTop };
  }

  /** 检查元素数量，超出时自动归档当前页 */
  private checkPageCapacity(): void {
    const count = whiteboardStore.getElements().length;
    if (count >= MobileActionEngine.MAX_ELEMENTS_PER_PAGE) {
      console.log(`[ActionEngine] Page capacity (${count} >= ${MobileActionEngine.MAX_ELEMENTS_PER_PAGE}), auto-archiving`);
      whiteboardStore.archiveCurrentPage();
    }
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

    // Use LLM-provided absolute coordinates, clamped to canvas
    const rawLeft = params.x ?? 60;
    const rawTop = params.y ?? 0;
    let rawWidth = params.width ?? 880;
    let rawHeight = params.height ?? Math.max(40, fontSize * 2);

    // 自动加宽：如果文字内容超出容器宽度，按文字长度估算所需宽度
    const plainText = content.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ');
    const textLines = plainText.split('\n');
    const longestLine = Math.max(...textLines.map((l: string) => l.length));
    // 中文每字约 fontSize px，英文约 0.6 fontSize px
    // 安全起见用 1.0 系数（宁可靠宽也不溢出）
    const estimatedTextWidth = longestLine * fontSize * 1.0 + 16; // +16 padding
    if (estimatedTextWidth > rawWidth) {
      console.log(`[ActionEngine] drawText: auto-widen ${rawWidth}→${estimatedTextWidth} (text=${longestLine}chars, fontSize=${fontSize})`);
      rawWidth = estimatedTextWidth;
    }

    // 自动加高：根据文字内容和容器宽度估算换行后的实际高度
    // 碰撞检测依赖准确的高度，否则多行文字的实际渲染高度远大于声明高度，
    // 后续元素会堆叠到当前文字元素上
    const charsPerLine = Math.max(1, Math.floor(rawWidth / (fontSize * 1.0)));
    let estimatedLines = 0;
    for (const line of textLines) {
      if (line.length === 0) {
        estimatedLines += 1;
      } else {
        estimatedLines += Math.ceil(line.length / charsPerLine);
      }
    }
    const estimatedHeight = estimatedLines * fontSize * 1.5 + 16; // 行高 1.5x + 16px padding
    if (estimatedHeight > rawHeight) {
      console.log(`[ActionEngine] drawText: auto-height ${rawHeight}→${estimatedHeight} (${estimatedLines} lines, fontSize=${fontSize})`);
      rawHeight = estimatedHeight;
    }

    const clamped = this.clampToCanvas(rawLeft, rawTop, rawWidth, rawHeight);
    const { left, top } = this.resolveCollision(clamped.left, clamped.top, clamped.width, clamped.height, 'text');
    const width = clamped.width;
    const height = clamped.height;
    this.checkPageCapacity();

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

    const rawLeft = params.x ?? 60;
    const rawTop = params.y ?? 0;
    // 最小尺寸保障：移动端缩放后仍可读
    const rawWidth = Math.max(params.width ?? 200, 300);
    const rawHeight = Math.max(params.height ?? 80, 100);
    const clamped = this.clampToCanvas(rawLeft, rawTop, rawWidth, rawHeight);
    const { left, top } = this.resolveCollision(clamped.left, clamped.top, clamped.width, clamped.height, 'shape');
    const width = clamped.width;
    const height = clamped.height;
    this.checkPageCapacity();

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
    const startX = Math.max(0, Math.min(params.startX ?? 0, 1000));
    const startY = Math.max(0, params.startY ?? 0);
    const endX = Math.max(0, Math.min(params.endX ?? 100, 1000));
    const endY = Math.max(0, params.endY ?? 100);

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

    const rawLeft = params.x ?? 60;
    const rawTop = params.y ?? 0;
    const rawWidth = params.width ?? 880;
    const rawHeight = params.height ?? 60;
    const clamped = this.clampToCanvas(rawLeft, rawTop, rawWidth, rawHeight);
    const { left, top } = this.resolveCollision(clamped.left, clamped.top, clamped.width, clamped.height, 'text');
    const width = clamped.width;
    const height = clamped.height;
    this.checkPageCapacity();

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
    const clamped = this.clampToCanvas(
      params.x ?? 60, params.y ?? 0, params.width ?? 880, params.height ?? 200
    );
    const { left, top } = this.resolveCollision(clamped.left, clamped.top, clamped.width, clamped.height, 'chart');
    const width = clamped.width;
    const height = clamped.height;
    this.checkPageCapacity();

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

    const clamped = this.clampToCanvas(
      params.x ?? 60, params.y ?? 0, params.width ?? 880, params.height ?? rows * 30 + 20
    );
    const { left, top } = this.resolveCollision(clamped.left, clamped.top, clamped.width, clamped.height, 'table');
    const width = clamped.width;
    const height = clamped.height;
    this.checkPageCapacity();

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

    const rawLeft = params.x ?? 60;
    const rawTop = params.y ?? 0;
    const rawWidth = params.width ?? 880;
    const rawHeight = params.height ?? codeLines.length * 15 + 40;
    const clamped = this.clampToCanvas(rawLeft, rawTop, rawWidth, rawHeight);
    const { left, top } = this.resolveCollision(clamped.left, clamped.top, clamped.width, clamped.height, 'code');
    const width = clamped.width;
    const height = clamped.height;
    this.checkPageCapacity();

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
