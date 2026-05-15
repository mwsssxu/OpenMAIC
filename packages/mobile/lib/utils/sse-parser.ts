/**
 * SSE 响应内容分段解析器
 * 将 Agent 回复中的不同内容段分离：
 * - 核心文本：主要内容
 * - 白板内容：包含 🖊️ 或代码块图表
 * - 引导思考：包含 🤔
 * - 结合背景：包含 💡
 */

export interface ParsedContent {
  /** 核心教学内容（去除标记内容） */
  coreText: string;
  /** 白板图示内容（包含图表、家谱等） */
  whiteboardContent: string | null;
  /** 引导思考内容（用于触发讨论） */
  thinkingPrompt: string | null;
  /** 结合背景内容 */
  backgroundNote: string | null;
  /** 是否包含白板 */
  hasWhiteboard: boolean;
  /** 是否包含引导思考 */
  hasThinkingPrompt: boolean;
}

/**
 * 解析 SSE text_delta 内容，分段提取
 */
export function parseSSEContent(fullText: string): ParsedContent {
  let coreText = '';
  let whiteboardContent: string | null = null;
  let thinkingPrompt: string | null = null;
  let backgroundNote: string | null = null;

  // 正则匹配不同标记段
  // 🖊️ **白板图示** 或代码块中的图表内容
  const whiteboardRegex = /🖊️\s*\*\*白板图示[^*]*\*\*\s*```[\s\S]*?```/;

  // 🤔 **引导思考**
  const thinkingRegex = /🤔\s*\*\*引导思考[^*]*\*\*[\s\S]*?(?=📌|💡|$)/;

  // 💡 **结合背景**
  const backgroundRegex = /💡\s*\*\*结合背景[^*]*\*\*[\s\S]*?(?=📌|🤔|🖊️|$)/;

  // 提取白板内容
  const whiteboardMatch = fullText.match(whiteboardRegex);
  if (whiteboardMatch) {
    whiteboardContent = whiteboardMatch[0];
    // 从核心文本中移除白板内容
    fullText = fullText.replace(whiteboardMatch[0], '');
  }

  // 提取引导思考
  const thinkingMatch = fullText.match(thinkingRegex);
  if (thinkingMatch) {
    thinkingPrompt = thinkingMatch[0];
    // 从核心文本中移除引导思考
    fullText = fullText.replace(thinkingMatch[0], '');
  }

  // 提取结合背景
  const backgroundMatch = fullText.match(backgroundRegex);
  if (backgroundMatch) {
    backgroundNote = backgroundMatch[0];
    // 从核心文本中移除结合背景
    fullText = fullText.replace(backgroundMatch[0], '');
  }

  // 清理剩余文本（移除多余空行）
  coreText = fullText
    .replace(/\n{3,}/g, '\n\n')  // 多个换行合并为两个
    .trim();

  return {
    coreText,
    whiteboardContent,
    thinkingPrompt,
    backgroundNote,
    hasWhiteboard: whiteboardContent !== null,
    hasThinkingPrompt: thinkingPrompt !== null,
  };
}

/**
 * 从白板内容中提取绘图 actions
 * 解析代码块中的图表结构，生成 wb_draw_text actions
 */
export function extractWhiteboardActions(whiteboardText: string): Array<{
  type: 'wb_draw_text' | 'wb_draw_shape';
  content?: string;
  x?: number;
  y?: number;
  shape?: 'box' | 'line' | 'arrow';
  color?: string;
}> {
  const actions: Array<any> = [];

  // 提取代码块内容
  const codeBlockMatch = whiteboardText.match(/```[\s\S]*?```/);
  if (!codeBlockMatch) return actions;

  const diagramText = codeBlockMatch[0].replace(/```\w*\n?/, '').replace(/```$/, '');

  // 将图表文本作为 wb_draw_text action
  // 简化处理：整个图表作为一个大文本块
  actions.push({
    type: 'wb_draw_text',
    content: diagramText,
    x: 50,
    y: 50,
    color: '#8b5cf6',
  });

  return actions;
}

/**
 * 从引导思考中提取讨论主题
 */
export function extractDiscussionTopic(thinkingPrompt: string): string {
  // 提取引导思考中的核心问题
  const lines = thinkingPrompt.split('\n');
  // 找到包含问题的行
  for (const line of lines) {
    if (line.includes('大家认为') || line.includes('谈谈你的看法') || line.includes('有何关联')) {
      return line.replace(/🤔\s*/, '').trim();
    }
  }
  // 返回第一行作为主题
  return lines[1] || lines[0] || '讨论话题';
}