/**
 * 导演图谱 — 基于 LangGraph StateGraph 的多智能体编排器
 *
 * 统一的图拓扑结构（单智能体和多智能体共用）：
 *
 *   START → director ──(end)──→ END
 *              │
 *              └─(next)→ agent_generate ──→ director (循环)
 *
 * 导演节点根据智能体数量采用不同策略：
 *   - 单智能体：纯代码逻辑（无需 LLM）。
 *     第 0 轮派遣该智能体发言，后续轮次提示用户发言。
 *   - 多智能体：基于 LLM 的决策（带有第 0 轮触发智能体和轮次限制的代码快速路径）。
 *
 * 使用 LangGraph 的自定义流模式：每个节点通过 config.writer() 推送
 * StatelessEvent 数据块，实现实时 SSE 传输。
 */

import { Annotation, StateGraph, START, END } from '@langchain/langgraph';
import { SystemMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import type { LangGraphRunnableConfig } from '@langchain/langgraph';
import type { LanguageModel } from 'ai';

import { AISdkLangGraphAdapter } from './ai-sdk-adapter';
import type { StatelessEvent } from '@/lib/types/chat';
import type { StatelessChatRequest } from '@/lib/types/chat';
import type { ThinkingConfig } from '@/lib/types/provider';
import type { AgentConfig } from '@/lib/orchestration/registry/types';
import { useAgentRegistry } from '@/lib/orchestration/registry/store';
import {
  buildStructuredPrompt,
  summarizeConversation,
  convertMessagesToOpenAI,
} from './prompt-builder';
import { buildDirectorPrompt, parseDirectorDecision } from './director-prompt';
import { getEffectiveActions } from './tool-schemas';
import type { AgentTurnSummary, WhiteboardActionRecord } from './director-prompt';
import { parseStructuredChunk, createParserState, finalizeParser } from './stateless-generate';
import { createLogger } from '@/lib/logger';

const log = createLogger('DirectorGraph');

// ==================== 状态定义 ====================

/**
 * 编排器图谱的 LangGraph 状态注解
 *
 * 状态分为两类：
 * 1. 输入状态：图入口时设置一次，后续不变
 * 2. 可变状态：节点运行时更新
 */
const OrchestratorState = Annotation.Root({
  // ── 输入状态（图入口时设置） ──
  
  /** 对话消息历史 */
  messages: Annotation<StatelessChatRequest['messages']>,
  
  /** 应用状态（报告、场景、白板等） */
  storeState: Annotation<StatelessChatRequest['storeState']>,
  
  /** 可用的智能体 ID 列表 */
  availableAgentIds: Annotation<string[]>,
  
  /** 最大轮次限制 */
  maxTurns: Annotation<number>,
  
  /** 语言模型实例 */
  languageModel: Annotation<LanguageModel>,
  
  /** 思考模式配置（如 Claude 的 extended thinking） */
  thinkingConfig: Annotation<ThinkingConfig | null>,
  
  /** 讨论上下文（话题和引导提示） */
  discussionContext: Annotation<{ topic: string; prompt?: string } | null>,
  
  /** 触发智能体 ID（首轮发言的智能体） */
  triggerAgentId: Annotation<string | null>,
  
  /** 用户画像（昵称、简介） */
  userProfile: Annotation<{ nickname?: string; bio?: string } | null>,
  
  /** 请求级别的智能体配置覆盖（用于动态生成的智能体，不在默认注册表中） */
  agentConfigOverrides: Annotation<Record<string, AgentConfig>>,

  // ── 可变状态（节点更新） ──
  
  /** 当前发言的智能体 ID */
  currentAgentId: Annotation<string | null>,
  
  /** 当前轮次计数 */
  turnCount: Annotation<number>,
  
  /** 智能体发言摘要列表（使用 reducer 累积） */
  agentResponses: Annotation<AgentTurnSummary[]>({
    reducer: (prev, update) => [...prev, ...update],
    default: () => [],
  }),
  
  /** 白板操作记录列表（使用 reducer 累积） */
  whiteboardLedger: Annotation<WhiteboardActionRecord[]>({
    reducer: (prev, update) => [...prev, ...update],
    default: () => [],
  }),
  
  /** 是否应该结束编排 */
  shouldEnd: Annotation<boolean>,
  
  /** 总动作数量 */
  totalActions: Annotation<number>,
});

/** 编排器状态类型 */
type OrchestratorStateType = typeof OrchestratorState.State;

/**
 * 查找智能体配置
 * 优先从请求级别的覆盖配置中查找，其次从全局注册表查找。
 * 这样保持服务器无状态 — 生成的智能体配置随请求传递。
 *
 * @param state - 编排器状态
 * @param agentId - 智能体 ID
 * @returns 智能体配置，未找到返回 undefined
 */
function resolveAgent(state: OrchestratorStateType, agentId: string): AgentConfig | undefined {
  return state.agentConfigOverrides[agentId] ?? useAgentRegistry.getState().getAgent(agentId);
}

// ==================== 导演节点 ====================

/**
 * 统一的导演节点：决定下一个发言的智能体
 *
 * 策略因智能体数量而异：
 *   单智能体 — 纯代码逻辑，零 LLM 调用：
 *     - 第 0 轮：派遣唯一的智能体发言
 *     - 第 1+ 轮：提示用户发言（保持会话活跃以便追问）
 *
 *   多智能体 — 基于 LLM 决策（带有代码快速路径）：
 *     - 第 0 轮 + 触发智能体：派遣触发智能体（跳过 LLM）
 *     - 其他情况：LLM 决定下一个智能体 / 用户 / 结束
 *
 * @param state - 当前编排器状态
 * @param config - LangGraph 运行配置（包含写入器）
 * @returns 状态更新对象
 */
async function directorNode(
  state: OrchestratorStateType,
  config: LangGraphRunnableConfig,
): Promise<Partial<OrchestratorStateType>> {
  // 获取 SSE 写入器，用于向前端推送事件
  const rawWrite = config.writer as (chunk: StatelessEvent) => void;
  const write = (chunk: StatelessEvent) => {
    try {
      rawWrite(chunk);
    } catch {
      // 控制器在中止后已关闭，忽略写入错误
    }
  };

  const isSingleAgent = state.availableAgentIds.length <= 1;

  // ── 轮次限制检查（适用于单智能体和多智能体） ──
  if (state.turnCount >= state.maxTurns) {
    log.info(`[Director] 已达到轮次上限 (${state.turnCount}/${state.maxTurns})，结束编排`);
    return { shouldEnd: true };
  }

  // ── 单智能体：纯代码导演 ──
  if (isSingleAgent) {
    const agentId = state.availableAgentIds[0] || 'default-1';

    if (state.turnCount === 0) {
      // 首轮：派遣智能体发言
      log.info(`[Director] 单智能体模式：派遣 "${agentId}" 发言`);
      write({ type: 'thinking', data: { stage: 'agent_loading', agentId } });
      return { currentAgentId: agentId, shouldEnd: false };
    }

    // 智能体已发言：提示用户继续追问
    log.info(`[Director] 单智能体模式：提示用户在 "${agentId}" 发言后继续`);
    write({ type: 'cue_user', data: { fromAgentId: agentId } });
    return { shouldEnd: true };
  }

  // ── 多智能体：首轮触发智能体的快速路径 ──
  if (state.turnCount === 0 && state.triggerAgentId) {
    const triggerId = state.triggerAgentId;
    if (state.availableAgentIds.includes(triggerId)) {
      log.info(`[Director] 首轮：派遣触发智能体 "${triggerId}"`);
      write({
        type: 'thinking',
        data: { stage: 'agent_loading', agentId: triggerId },
      });
      return { currentAgentId: triggerId, shouldEnd: false };
    }
    log.warn(
      `[Director] 触发智能体 "${triggerId}" 不在可用列表中，降级为 LLM 决策`,
    );
  }

  // ── 多智能体：基于 LLM 的决策 ──
  
  // 解析所有可用智能体的配置
  const agents: AgentConfig[] = state.availableAgentIds
    .map((id) => resolveAgent(state, id))
    .filter((a): a is AgentConfig => a != null);

  if (agents.length === 0) {
    log.warn('[Director] 没有可用的智能体，结束编排');
    return { shouldEnd: true };
  }

  // 通知前端：导演正在思考
  write({ type: 'thinking', data: { stage: 'director' } });

  // 构建对话摘要和导演提示词
  const openaiMessages = convertMessagesToOpenAI(state.messages);
  const conversationSummary = summarizeConversation(openaiMessages);

  const prompt = buildDirectorPrompt(
    agents,
    conversationSummary,
    state.agentResponses,
    state.turnCount,
    state.discussionContext,
    state.triggerAgentId,
    state.whiteboardLedger,
    state.userProfile || undefined,
    state.storeState.whiteboardOpen,
  );

  // 调试日志：打印导演提示词
  log.info(`\n${'*'.repeat(80)}
[DIRECTOR PROMPT] 第 ${state.turnCount} 轮
${'*'.repeat(80)}
${prompt}
${'*'.repeat(80)}
`);

  const adapter = new AISdkLangGraphAdapter(state.languageModel, state.thinkingConfig ?? undefined);

  try {
    // 调用 LLM 做出决策
    const result = await adapter._generate(
      [new SystemMessage(prompt), new HumanMessage('决定下一个发言的智能体。')],
      { signal: config.signal } as Record<string, unknown>,
    );

    const content = result.generations[0]?.text || '';
    log.info(`[Director] LLM 原始决策: ${content}`);

    // 解析决策结果
    const decision = parseDirectorDecision(content);

    // 决策：结束对话
    if (decision.shouldEnd || !decision.nextAgentId) {
      log.info('[Director] 决策：结束对话');
      return { shouldEnd: true };
    }

    // 决策：提示用户发言
    if (decision.nextAgentId === 'USER') {
      log.info('[Director] 决策：提示用户发言');
      write({
        type: 'cue_user',
        data: { fromAgentId: state.currentAgentId || undefined },
      });
      return { shouldEnd: true };
    }

    // 验证决策的智能体是否存在
    const agentExists = agents.some((a) => a.id === decision.nextAgentId);
    if (!agentExists) {
      log.warn(`[Director] 未知的智能体 "${decision.nextAgentId}"，结束编排`);
      return { shouldEnd: true };
    }

    // 决策：派遣智能体发言
    write({
      type: 'thinking',
      data: { stage: 'agent_loading', agentId: decision.nextAgentId },
    });

    log.info(`[Director] 决策：派遣智能体 "${decision.nextAgentId}" 发言`);
    return {
      currentAgentId: decision.nextAgentId,
      shouldEnd: false,
    };
  } catch (error) {
    log.error('[Director] 错误:', error);
    return { shouldEnd: true };
  }
}

/**
 * 导演节点条件判断
 * 根据 shouldEnd 状态决定下一步：结束或继续生成
 *
 * @param state - 当前编排器状态
 * @returns 下一个节点名称
 */
function directorCondition(state: OrchestratorStateType): 'agent_generate' | typeof END {
  return state.shouldEnd ? END : 'agent_generate';
}

// ==================== 智能体生成节点 ====================

/**
 * 运行单个智能体的生成过程
 *
 * 通过 config.writer() 流式输出以下事件：
 * - agent_start: 智能体开始发言
 * - text_delta: 文本增量更新
 * - action: 动作执行
 * - agent_end: 智能体发言结束
 *
 * @param state - 当前编排器状态
 * @param agentId - 要运行的智能体 ID
 * @param config - LangGraph 运行配置
 * @returns 生成结果：内容预览、动作数量、白板操作记录
 */
async function runAgentGeneration(
  state: OrchestratorStateType,
  agentId: string,
  config: LangGraphRunnableConfig,
): Promise<{
  contentPreview: string;
  actionCount: number;
  whiteboardActions: WhiteboardActionRecord[];
}> {
  // 获取智能体配置
  const agentConfig = resolveAgent(state, agentId);
  if (!agentConfig) {
    throw new Error(`智能体未找到: ${agentId}`);
  }

  // 获取 SSE 写入器
  const rawWrite = config.writer as (chunk: StatelessEvent) => void;
  const write = (chunk: StatelessEvent) => {
    try {
      rawWrite(chunk);
    } catch (e) {
      log.warn(`[AgentGenerate] 写入失败 (${agentId}):`, e);
    }
  };

  // 生成唯一消息 ID
  const messageId = `assistant-${agentId}-${Date.now()}`;

  // 发送智能体开始事件
  write({
    type: 'agent_start',
    data: {
      messageId,
      agentId,
      agentName: agentConfig.name,
      agentAvatar: agentConfig.avatar,
      agentColor: agentConfig.color,
    },
  });

  // ── 计算有效动作：按场景类型过滤（深度防御） ──
  // 例如：spotlight/laser 在非幻灯片场景中被移除
  const currentScene = state.storeState.currentSceneId
    ? state.storeState.scenes.find((s) => s.id === state.storeState.currentSceneId)
    : undefined;
  const sceneType = currentScene?.type;
  const effectiveActions = getEffectiveActions(agentConfig.allowedActions, sceneType);

  // ── 构建系统提示词 ──
  const discussionContext = state.discussionContext || undefined;
  const systemPrompt = buildStructuredPrompt(
    agentConfig,
    state.storeState,
    discussionContext,
    state.whiteboardLedger,
    state.userProfile || undefined,
    state.agentResponses,
  );
  const openaiMessages = convertMessagesToOpenAI(state.messages, agentId);

  // 调试日志：打印完整的智能体提示词
  log.info(`\n${'='.repeat(80)}
[AGENT PROMPT] ${agentConfig.name} (${agentId})
${'='.repeat(80)}
${systemPrompt}
${'='.repeat(80)}
[MESSAGES] ${openaiMessages.length} 条消息
${openaiMessages.map((m, i) => `[${i}] ${m.role}: ${m.content.slice(0, 200)}${m.content.length > 200 ? '...' : ''}`).join('\n')}
${'='.repeat(80)}
`);

  const adapter = new AISdkLangGraphAdapter(state.languageModel, state.thinkingConfig ?? undefined);

  // 构建消息列表
  const lcMessages = [
    new SystemMessage(systemPrompt),
    ...openaiMessages.map((m) =>
      m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content),
    ),
  ];

  // 确保消息列表以 HumanMessage 结尾
  // 经过智能体感知的角色映射后，其他智能体的消息变成 user 角色，
  // 所以末尾是 AIMessage 的可能性较低。但仍需防范边缘情况
  // （例如智能体自己之前的回复是历史记录中的最后一条）。
  const lastMsg = lcMessages[lcMessages.length - 1];
  if (!lcMessages.some((m) => m instanceof HumanMessage)) {
    lcMessages.push(new HumanMessage('请开始发言。'));
  } else if (lastMsg instanceof AIMessage) {
    lcMessages.push(new HumanMessage('轮到你发言了。请从你的视角回应。'));
  }

  // ── 流式生成并解析输出 ──
  const parserState = createParserState();
  let fullText = '';
  let actionCount = 0;
  const whiteboardActions: WhiteboardActionRecord[] = [];

  try {
    for await (const chunk of adapter.streamGenerate(lcMessages, {
      signal: config.signal,
    })) {
      if (chunk.type === 'delta') {
        const parseResult = parseStructuredChunk(chunk.content, parserState);

        // 通过 `ordered` 数组按原始交错顺序发射事件。
        // ordered 数组跟踪解析器第 5 步产生的完整项目；
        // 尾部的部分文本增量（第 6 步）在 textChunks 中但不在 ordered 中。
        let emittedTextCount = 0;
        if (parseResult.ordered.length > 0 || parseResult.textChunks.length > 0) {
          log.debug(
            `[AgentGenerate] 解析结果: ordered=${parseResult.ordered.length} (${parseResult.ordered.map((e) => e.type).join(',')}), textChunks=${parseResult.textChunks.length}, actions=${parseResult.actions.length}, done=${parseResult.isDone}`,
          );
        }

        // 按 ordered 顺序处理
        for (const entry of parseResult.ordered) {
          if (entry.type === 'text') {
            // 处理文本
            const rawText = parseResult.textChunks[entry.index];
            if (!rawText) {
              log.warn(
                `[AgentGenerate] ordered 文本条目 index=${entry.index} 但 textChunks[${entry.index}] 为空`,
              );
              continue;
            }
            // 移除引用标记（> 符号）
            const text = rawText.replace(/^>+\s?/gm, '');
            if (!text) continue;
            fullText += text;
            write({
              type: 'text_delta',
              data: { content: text, messageId },
            });
            emittedTextCount++;
          } else if (entry.type === 'action') {
            // 处理动作
            const ac = parseResult.actions[entry.index];
            if (!ac) continue;
            
            // 验证动作是否被允许
            if (!effectiveActions.includes(ac.actionName)) {
              log.warn(
                `[AgentGenerate] 智能体 ${agentConfig.name} 尝试执行未授权的动作: ${ac.actionName}，跳过`,
              );
              continue;
            }
            
            actionCount++;
            
            // 记录白板操作到账本
            if (ac.actionName.startsWith('wb_')) {
              whiteboardActions.push({
                actionName: ac.actionName as WhiteboardActionRecord['actionName'],
                agentId,
                agentName: agentConfig.name,
                params: ac.params,
              });
            }
            
            write({
              type: 'action',
              data: {
                actionId: ac.actionId,
                actionName: ac.actionName,
                params: ac.params,
                agentId,
                messageId,
              },
            });
          }
        }

        // 发射 ordered 未覆盖的尾部部分文本增量
        for (let i = emittedTextCount; i < parseResult.textChunks.length; i++) {
          const rawText = parseResult.textChunks[i];
          if (!rawText) continue;
          const text = rawText.replace(/^>+\s?/gm, '');
          if (!text) continue;
          fullText += text;
          write({
            type: 'text_delta',
            data: { content: text, messageId },
          });
        }
      }
    }

    // ── 完成：如果模型未产生有效 JSON，发射剩余内容 ──
    const finalResult = finalizeParser(parserState);
    for (const entry of finalResult.ordered) {
      if (entry.type === 'text') {
        const rawText = finalResult.textChunks[entry.index];
        if (!rawText) continue;
        const text = rawText.replace(/^>+\s?/gm, '');
        if (!text) continue;
        fullText += text;
        write({
          type: 'text_delta',
          data: { content: text, messageId },
        });
      }
    }
  } catch (error) {
    // 中止错误直接抛出，让外层处理
    if (error instanceof Error && error.name === 'AbortError') {
      throw error;
    }
    log.error(`[AgentGenerate] 智能体 ${agentConfig.name} 生成错误:`, error);
    write({
      type: 'error',
      data: { message: error instanceof Error ? error.message : String(error) },
    });
  }

  // 发送智能体结束事件
  write({
    type: 'agent_end',
    data: { messageId, agentId },
  });

  return {
    contentPreview: fullText.slice(0, 300),
    actionCount,
    whiteboardActions,
  };
}

/**
 * 智能体生成节点
 * 运行一个智能体，然后循环回到导演节点。
 *
 * @param state - 当前编排器状态
 * @param config - LangGraph 运行配置
 * @returns 状态更新对象
 */
async function agentGenerateNode(
  state: OrchestratorStateType,
  config: LangGraphRunnableConfig,
): Promise<Partial<OrchestratorStateType>> {
  const agentId = state.currentAgentId;
  if (!agentId) {
    log.warn('[AgentGenerate] 没有当前智能体 ID，结束编排');
    return { shouldEnd: true };
  }

  const agentConfig = resolveAgent(state, agentId);
  const result = await runAgentGeneration(state, agentId, config);

  // 警告：空响应
  if (!result.contentPreview && result.actionCount === 0) {
    log.warn(
      `[AgentGenerate] 智能体 "${agentConfig?.name || agentId}" 产生了空响应（无文本、无动作）`,
    );
  }

  return {
    turnCount: state.turnCount + 1,
    totalActions: state.totalActions + result.actionCount,
    agentResponses: [
      {
        agentId,
        agentName: agentConfig?.name || agentId,
        contentPreview: result.contentPreview,
        actionCount: result.actionCount,
        whiteboardActions: result.whiteboardActions,
      },
    ],
    whiteboardLedger: result.whiteboardActions,
    currentAgentId: null,
  };
}

// ==================== 图构建 ====================

/**
 * 创建编排 LangGraph StateGraph
 *
 * 拓扑结构：
 *   START → director ──(end)──→ END
 *              │
 *              └─(next)→ agent_generate ──→ director (循环)
 *
 * 流程说明：
 * 1. 从 START 进入 director 节点
 * 2. director 决定：结束 → END，或派遣智能体 → agent_generate
 * 3. agent_generate 执行智能体生成后，循环回到 director
 * 4. 重复直到 director 决定结束
 *
 * @returns 编译后的 LangGraph 图
 */
export function createOrchestrationGraph() {
  const graph = new StateGraph(OrchestratorState)
    .addNode('director', directorNode)           // 导演节点
    .addNode('agent_generate', agentGenerateNode) // 智能体生成节点
    .addEdge(START, 'director')                   // 入口边
    .addConditionalEdges('director', directorCondition, {
      agent_generate: 'agent_generate',           // 继续生成
      [END]: END,                                 // 结束
    })
    .addEdge('agent_generate', 'director');       // 循环回导演

  return graph.compile();
}

/**
 * 从 StatelessChatRequest 构建编排器图的初始状态
 *
 * @param request - 无状态聊天请求
 * @param languageModel - 预创建的语言模型实例
 * @param thinkingConfig - 可选的思考模式配置
 * @returns 初始状态对象
 */
export function buildInitialState(
  request: StatelessChatRequest,
  languageModel: LanguageModel,
  thinkingConfig?: ThinkingConfig,
): typeof OrchestratorState.State {
  // 构建请求级别的智能体配置覆盖，用于动态生成的智能体。
  // 这些配置随请求传递 — 无需服务器端持久化。
  const agentConfigOverrides: Record<string, AgentConfig> = {};
  if (request.config.agentConfigs?.length) {
    for (const cfg of request.config.agentConfigs) {
      agentConfigOverrides[cfg.id] = {
        ...cfg,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
  }

  // 构建讨论上下文
  const discussionContext = request.config.discussionTopic
    ? {
        topic: request.config.discussionTopic,
        prompt: request.config.discussionPrompt,
      }
    : null;

  // 从传入的导演状态恢复轮次
  const incoming = request.directorState;
  const turnCount = incoming?.turnCount ?? 0;

  return {
    // 输入状态
    messages: request.messages,
    storeState: request.storeState,
    availableAgentIds: request.config.agentIds,
    maxTurns: turnCount + 1, // 允许恰好一轮 director→agent 循环
    languageModel,
    thinkingConfig: thinkingConfig ?? null,
    discussionContext,
    triggerAgentId: request.config.triggerAgentId || null,
    userProfile: request.userProfile || null,
    agentConfigOverrides,
    
    // 可变状态（初始值）
    currentAgentId: null,
    turnCount,
    agentResponses: incoming?.agentResponses ?? [],
    whiteboardLedger: incoming?.whiteboardLedger ?? [],
    shouldEnd: false,
    totalActions: 0,
  };
}