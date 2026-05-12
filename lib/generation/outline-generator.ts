/**
 * 大纲生成器 - 第一阶段：从用户需求生成场景大纲
 *
 * 核心职责：
 * - 解析用户输入的需求文本
 * - 结合 PDF 文档内容（如有）生成结构化的场景大纲
 * - 处理大纲类型回退逻辑（如 interactive 缺少配置则回退为 slide）
 *
 * 生成流程：
 *   用户需求 + PDF 内容 → AI 分析 → 场景大纲数组（SceneOutline[]）
 *
 * 场景大纲包含：
 *   - 场景类型（slide/quiz/interactive/pbl）
 *   - 标题、描述、要点
 *   - 类型特定配置（如 quizConfig、interactiveConfig、pblConfig）
 *   - 媒体生成请求（mediaGenerations）
 */

import { nanoid } from 'nanoid';
import { MAX_PDF_CONTENT_CHARS, MAX_VISION_IMAGES } from '@/lib/constants/generation';
import type {
  UserRequirements,
  SceneOutline,
  PdfImage,
  ImageMapping,
} from '@/lib/types/generation';
import { buildPrompt, PROMPT_IDS } from './prompts';
import { formatImageDescription, formatImagePlaceholder } from './prompt-formatters';
import { parseJsonResponse } from './json-repair';
import { uniquifyMediaElementIds } from './scene-builder';
import type { AICallFn, GenerationResult, GenerationCallbacks } from './pipeline-types';
import { createLogger } from '@/lib/logger';
const log = createLogger('Generation');

/**
 * 从用户需求生成场景大纲
 *
 * 使用简化的 UserRequirements 结构（仅需需求文本和语言），
 * 结合可选的 PDF 内容和图片，通过 AI 生成结构化的课程大纲。
 *
 * @param requirements - 用户需求（需求文本、语言、用户昵称/简介）
 * @param pdfText - PDF 提取的文本内容（可选）
 * @param pdfImages - PDF 提取的图片列表（可选）
 * @param aiCall - AI 调用函数
 * @param callbacks - 生成进度回调
 * @param options - 可选配置
 *   - visionEnabled: 是否启用视觉模型（多模态）
 *   - imageMapping: 图片 ID → URL 映射
 *   - imageGenerationEnabled: 是否启用 AI 图片生成
 *   - videoGenerationEnabled: 是否启用 AI 视频生成
 *   - researchContext: 研究背景上下文
 *   - teacherContext: 教师人设上下文
 *
 * @returns 生成的场景大纲数组，或错误信息
 */
export async function generateSceneOutlinesFromRequirements(
  requirements: UserRequirements,
  pdfText: string | undefined,
  pdfImages: PdfImage[] | undefined,
  aiCall: AICallFn,
  callbacks?: GenerationCallbacks,
  options?: {
    visionEnabled?: boolean;
    imageMapping?: ImageMapping;
    imageGenerationEnabled?: boolean;
    videoGenerationEnabled?: boolean;
    researchContext?: string;
    teacherContext?: string;
  },
): Promise<GenerationResult<SceneOutline[]>> {
  // 构建可用图片的描述，用于 AI 提示
  let availableImagesText =
    requirements.language === 'zh-CN' ? '无可用图片' : 'No images available';
  let visionImages: Array<{ id: string; src: string }> | undefined;

  if (pdfImages && pdfImages.length > 0) {
    if (options?.visionEnabled && options?.imageMapping) {
      // 视觉模式：分为视觉图片（前 N 张）和纯文本描述（其余）
      const allWithSrc = pdfImages.filter((img) => options.imageMapping![img.id]);
      const visionSlice = allWithSrc.slice(0, MAX_VISION_IMAGES);
      const textOnlySlice = allWithSrc.slice(MAX_VISION_IMAGES);
      const noSrcImages = pdfImages.filter((img) => !options.imageMapping![img.id]);

      const visionDescriptions = visionSlice.map((img) =>
        formatImagePlaceholder(img, requirements.language),
      );
      const textDescriptions = [...textOnlySlice, ...noSrcImages].map((img) =>
        formatImageDescription(img, requirements.language),
      );
      availableImagesText = [...visionDescriptions, ...textDescriptions].join('\n');

      visionImages = visionSlice.map((img) => ({
        id: img.id,
        src: options.imageMapping![img.id],
        width: img.width,
        height: img.height,
      }));
    } else {
      // 纯文本模式：仅使用图片描述
      availableImagesText = pdfImages
        .map((img) => formatImageDescription(img, requirements.language))
        .join('\n');
    }
  }

  // 构建用户简介字符串，用于提示注入
  const userProfileText =
    requirements.userNickname || requirements.userBio
      ? `## Student Profile\n\nStudent: ${requirements.userNickname || 'Unknown'}${requirements.userBio ? ` — ${requirements.userBio}` : ''}\n\nConsider this student's background when designing the course. Adapt difficulty, examples, and teaching approach accordingly.\n\n---`
      : '';

  // 根据启用状态构建媒体生成策略
  const imageEnabled = options?.imageGenerationEnabled ?? false;
  const videoEnabled = options?.videoGenerationEnabled ?? false;
  let mediaGenerationPolicy = '';
  if (!imageEnabled && !videoEnabled) {
    mediaGenerationPolicy =
      '**IMPORTANT: Do NOT include any mediaGenerations in the outlines. Both image and video generation are disabled.**';
  } else if (!imageEnabled) {
    mediaGenerationPolicy =
      '**IMPORTANT: Do NOT include any image mediaGenerations (type: "image") in the outlines. Image generation is disabled. Video generation is allowed.**';
  } else if (!videoEnabled) {
    mediaGenerationPolicy =
      '**IMPORTANT: Do NOT include any video mediaGenerations (type: "video") in the outlines. Video generation is disabled. Image generation is allowed.**';
  }

  log.info(`[Outline] Starting generation - requirement length: ${requirements.requirement.length}`);

  // 使用简化的提示变量构建提示
  const prompts = buildPrompt(PROMPT_IDS.REQUIREMENTS_TO_OUTLINES, {
    // 简化的变量
    requirement: requirements.requirement,
    language: requirements.language,
    pdfContent: pdfText
      ? pdfText.substring(0, MAX_PDF_CONTENT_CHARS)
      : requirements.language === 'zh-CN'
        ? '无'
        : 'None',
    availableImages: availableImagesText,
    userProfile: userProfileText,
    mediaGenerationPolicy,
    researchContext:
      options?.researchContext || (requirements.language === 'zh-CN' ? '无' : 'None'),
    // 服务端生成通过 options 填充；客户端通过 formatTeacherPersonaForPrompt 填充
    teacherContext: options?.teacherContext || '',
  });

  if (!prompts) {
    return { success: false, error: 'Prompt template not found' };
  }

  // [DEBUG] 打印prompt信息
  log.info(`[Outline] System prompt length: ${prompts.system.length} chars`);
  log.info(`[Outline] User prompt length: ${prompts.user.length} chars`);
  log.info(`[Outline] Total prompt length: ${prompts.system.length + prompts.user.length} chars`);

  try {
    // 发送进度回调
    callbacks?.onProgress?.({
      currentStage: 1,
      overallProgress: 20,
      stageProgress: 50,
      statusMessage: '正在分析需求，生成场景大纲...',
      scenesGenerated: 0,
      totalScenes: 0,
    });

    // 调用 AI 生成大纲
    const response = await aiCall(prompts.system, prompts.user, visionImages);
    const outlines = parseJsonResponse<SceneOutline[]>(response);

    if (!outlines || !Array.isArray(outlines)) {
      return {
        success: false,
        error: 'Failed to parse scene outlines response',
      };
    }

    // 确保 ID、顺序和语言字段存在
    const enriched = outlines.map((outline, index) => ({
      ...outline,
      id: outline.id || nanoid(),
      order: index + 1,
      language: requirements.language,
    }));

    // 将顺序的 gen_img_N/gen_vid_N 替换为全局唯一 ID
    const result = uniquifyMediaElementIds(enriched);

    // 发送完成进度回调
    callbacks?.onProgress?.({
      currentStage: 1,
      overallProgress: 50,
      stageProgress: 100,
      statusMessage: `已生成 ${result.length} 个场景大纲`,
      scenesGenerated: 0,
      totalScenes: result.length,
    });

    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * 应用大纲类型回退逻辑
 *
 * 当大纲无法按声明的类型生成时，回退为更简单的类型：
 * - interactive 缺少 interactiveConfig → 回退为 slide
 * - pbl 缺少 pblConfig 或 languageModel → 回退为 slide
 *
 * 这确保了即使某些配置缺失，课程生成也能继续进行，
 * 而不是完全失败。
 *
 * @param outline - 原始场景大纲
 * @param hasLanguageModel - 是否有可用的语言模型（PBL 需要）
 * @returns 可能回退后的场景大纲
 */
export function applyOutlineFallbacks(
  outline: SceneOutline,
  hasLanguageModel: boolean,
): SceneOutline {
  if (outline.type === 'interactive' && !outline.interactiveConfig) {
    log.warn(
      `Interactive outline "${outline.title}" missing interactiveConfig, falling back to slide`,
    );
    return { ...outline, type: 'slide' };
  }
  if (outline.type === 'pbl' && (!outline.pblConfig || !hasLanguageModel)) {
    log.warn(
      `PBL outline "${outline.title}" missing pblConfig or languageModel, falling back to slide`,
    );
    return { ...outline, type: 'slide' };
  }
  return outline;
}
