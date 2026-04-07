/**
 * Prompt and context building utilities for the generation pipeline.
 */

import type { PdfImage, StrategicContext } from '@/lib/types/generation';
import type { AgentInfo, SceneGenerationContext } from './pipeline-types';

/**
 * Format strategic context for injection into outline/content prompts.
 * Converts structured user situation into readable context for informed analysis.
 */
export function formatStrategicContext(ctx: StrategicContext | undefined, language: string): string {
  if (!ctx) return '';
  
  const lines: string[] = [];
  const isZh = language === 'zh-CN';
  
  // Decision Context
  if (ctx.decisionQuestion || ctx.timeline || ctx.urgency) {
    lines.push(isZh ? '## 决策背景' : '## Decision Context');
    if (ctx.decisionQuestion) {
      lines.push(isZh ? `**核心决策问题**: ${ctx.decisionQuestion}` : `**Decision Question**: ${ctx.decisionQuestion}`);
    }
    if (ctx.timeline) {
      lines.push(isZh ? `**决策时限**: ${ctx.timeline}` : `**Timeline**: ${ctx.timeline}`);
    }
    if (ctx.urgency) {
      const urgencyLabels = isZh 
        ? { low: '低', medium: '中', high: '高', critical: '紧急' }
        : { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' };
      lines.push(isZh ? `**紧迫程度**: ${urgencyLabels[ctx.urgency]}` : `**Urgency**: ${urgencyLabels[ctx.urgency]}`);
    }
    lines.push('');
  }
  
  // Organization Profile
  if (ctx.organizationName || ctx.industry || ctx.companySize || ctx.revenueRange || ctx.markets?.length) {
    lines.push(isZh ? '## 组织概况' : '## Organization Profile');
    if (ctx.organizationName) {
      lines.push(isZh ? `**组织名称**: ${ctx.organizationName}` : `**Organization**: ${ctx.organizationName}`);
    }
    if (ctx.industry) {
      lines.push(isZh ? `**所属行业**: ${ctx.industry}` : `**Industry**: ${ctx.industry}`);
    }
    if (ctx.companySize) {
      const sizeLabels = isZh
        ? { startup: '初创企业', sme: '中小企业', enterprise: '大型企业' }
        : { startup: 'Startup', sme: 'SME', enterprise: 'Enterprise' };
      lines.push(isZh ? `**企业规模**: ${sizeLabels[ctx.companySize]}` : `**Company Size**: ${sizeLabels[ctx.companySize]}`);
    }
    if (ctx.revenueRange) {
      lines.push(isZh ? `**营收规模**: ${ctx.revenueRange}` : `**Revenue Range**: ${ctx.revenueRange}`);
    }
    if (ctx.markets?.length) {
      lines.push(isZh ? `**目标市场**: ${ctx.markets.join(', ')}` : `**Target Markets**: ${ctx.markets.join(', ')}`);
    }
    lines.push('');
  }
  
  // Stakeholders
  if (ctx.targetAudience?.length || ctx.decisionMakers?.length) {
    lines.push(isZh ? '## 利益相关者' : '## Stakeholders');
    if (ctx.targetAudience?.length) {
      lines.push(isZh ? `**报告受众**: ${ctx.targetAudience.join(', ')}` : `**Target Audience**: ${ctx.targetAudience.join(', ')}`);
    }
    if (ctx.decisionMakers?.length) {
      lines.push(isZh ? `**决策者**: ${ctx.decisionMakers.join(', ')}` : `**Decision Makers**: ${ctx.decisionMakers.join(', ')}`);
    }
    lines.push('');
  }
  
  // Constraints & Priorities
  if (ctx.budgetConstraints || ctx.resourceConstraints?.length || ctx.riskTolerance || ctx.priorities?.length) {
    lines.push(isZh ? '## 约束与优先级' : '## Constraints & Priorities');
    if (ctx.budgetConstraints) {
      lines.push(isZh ? `**预算约束**: ${ctx.budgetConstraints}` : `**Budget Constraints**: ${ctx.budgetConstraints}`);
    }
    if (ctx.resourceConstraints?.length) {
      lines.push(isZh ? `**资源约束**: ${ctx.resourceConstraints.join(', ')}` : `**Resource Constraints**: ${ctx.resourceConstraints.join(', ')}`);
    }
    if (ctx.riskTolerance) {
      const riskLabels = isZh
        ? { conservative: '保守型', moderate: '平衡型', aggressive: '进取型' }
        : { conservative: 'Conservative', moderate: 'Moderate', aggressive: 'Aggressive' };
      lines.push(isZh ? `**风险偏好**: ${riskLabels[ctx.riskTolerance]}` : `**Risk Tolerance**: ${riskLabels[ctx.riskTolerance]}`);
    }
    if (ctx.priorities?.length) {
      lines.push(isZh ? `**核心优先级**:` : `**Top Priorities**:`);
      ctx.priorities.forEach((p, i) => {
        lines.push(`  ${i + 1}. ${p}`);
      });
    }
    lines.push('');
  }
  
  // Available Data
  if (ctx.availableData?.length || ctx.dataGaps?.length || ctx.competitorInfo?.length) {
    lines.push(isZh ? '## 数据与信息' : '## Data & Information');
    if (ctx.availableData?.length) {
      lines.push(isZh ? `**已有数据**: ${ctx.availableData.join(', ')}` : `**Available Data**: ${ctx.availableData.join(', ')}`);
    }
    if (ctx.dataGaps?.length) {
      lines.push(isZh ? `**数据缺口**: ${ctx.dataGaps.join(', ')}` : `**Data Gaps**: ${ctx.dataGaps.join(', ')}`);
    }
    if (ctx.competitorInfo?.length) {
      lines.push(isZh ? `**竞争对手信息**: ${ctx.competitorInfo.join(', ')}` : `**Competitor Info**: ${ctx.competitorInfo.join(', ')}`);
    }
    lines.push('');
  }
  
  // Background & History
  if (ctx.previousDecisions || ctx.challenges?.length || ctx.successCriteria?.length) {
    lines.push(isZh ? '## 背景与历史' : '## Background & History');
    if (ctx.previousDecisions) {
      lines.push(isZh ? `**过往决策**: ${ctx.previousDecisions}` : `**Previous Decisions**: ${ctx.previousDecisions}`);
    }
    if (ctx.challenges?.length) {
      lines.push(isZh ? `**当前挑战**: ${ctx.challenges.join(', ')}` : `**Current Challenges**: ${ctx.challenges.join(', ')}`);
    }
    if (ctx.successCriteria?.length) {
      lines.push(isZh ? `**成功标准**: ${ctx.successCriteria.join(', ')}` : `**Success Criteria**: ${ctx.successCriteria.join(', ')}`);
    }
    lines.push('');
  }
  
  return lines.join('\n');
}

/** Build a course context string for injection into action prompts */
export function buildCourseContext(ctx?: SceneGenerationContext): string {
  if (!ctx) return '';

  const lines: string[] = [];

  // Course outline with position marker
  lines.push('Course Outline:');
  ctx.allTitles.forEach((t, i) => {
    const marker = i === ctx.pageIndex - 1 ? ' ← current' : '';
    lines.push(`  ${i + 1}. ${t}${marker}`);
  });

  // Position information
  lines.push('');
  lines.push(
    'IMPORTANT: All pages belong to the SAME class session. Do NOT greet again after the first page. When referencing content from earlier pages, say "we just covered" or "as mentioned on page N" — NEVER say "last class" or "previous session" because there is no previous session.',
  );
  lines.push('');
  if (ctx.pageIndex === 1) {
    lines.push('Position: This is the FIRST page. Open with a greeting and course introduction.');
  } else if (ctx.pageIndex === ctx.totalPages) {
    lines.push('Position: This is the LAST page. Conclude the course with a summary and closing.');
    lines.push(
      'Transition: Continue naturally from the previous page. Do NOT greet or re-introduce.',
    );
  } else {
    lines.push(`Position: Page ${ctx.pageIndex} of ${ctx.totalPages} (middle of the course).`);
    lines.push(
      'Transition: Continue naturally from the previous page. Do NOT greet or re-introduce.',
    );
  }

  // Previous page speech for transition reference
  if (ctx.previousSpeeches.length > 0) {
    lines.push('');
    lines.push('Previous page speech (for transition reference):');
    const lastSpeech = ctx.previousSpeeches[ctx.previousSpeeches.length - 1];
    lines.push(`  "...${lastSpeech.slice(-150)}"`);
  }

  return lines.join('\n');
}

/** Format agent list for injection into action prompts */
export function formatAgentsForPrompt(agents?: AgentInfo[]): string {
  if (!agents || agents.length === 0) return '';

  const lines = ['Classroom Agents:'];
  for (const a of agents) {
    const personaPart = a.persona ? ` — ${a.persona}` : '';
    lines.push(`- id: "${a.id}", name: "${a.name}", role: ${a.role}${personaPart}`);
  }
  return lines.join('\n');
}

/** Extract the lead analyst agent's persona for injection into outline/content prompts */
export function formatAnalystPersonaForPrompt(agents?: AgentInfo[]): string {
  if (!agents || agents.length === 0) return '';

  const analyst = agents.find((a) => a.role === 'analyst');
  if (!analyst?.persona) return '';

  return `Lead Analyst Persona:\nName: ${analyst.name}\n${analyst.persona}\n\nAdapt the content style and tone to match this analyst's personality. IMPORTANT: The analyst's name and identity must NOT appear on the slides — no "${analyst.name}'s analysis", no "Analyst's notes", etc. Slides should read as neutral, professional business documents.`;
}

/**
 * Format a single PdfImage description for prompt inclusion.
 * Includes dimension/aspect-ratio info when available.
 */
export function formatImageDescription(img: PdfImage, language: string): string {
  let dimInfo = '';
  if (img.width && img.height) {
    const ratio = (img.width / img.height).toFixed(2);
    dimInfo = ` | 尺寸: ${img.width}×${img.height} (宽高比${ratio})`;
  }
  const desc = img.description ? ` | ${img.description}` : '';
  return language === 'zh-CN'
    ? `- **${img.id}**: 来自PDF第${img.pageNumber}页${dimInfo}${desc}`
    : `- **${img.id}**: from PDF page ${img.pageNumber}${dimInfo}${desc}`;
}

/**
 * Format a short image placeholder for vision mode.
 * Only ID + page + dimensions + aspect ratio (no description), since the model can see the actual image.
 */
export function formatImagePlaceholder(img: PdfImage, language: string): string {
  let dimInfo = '';
  if (img.width && img.height) {
    const ratio = (img.width / img.height).toFixed(2);
    dimInfo = ` | 尺寸: ${img.width}×${img.height} (宽高比${ratio})`;
  }
  return language === 'zh-CN'
    ? `- **${img.id}**: PDF第${img.pageNumber}页的图片${dimInfo} [参见附图]`
    : `- **${img.id}**: image from PDF page ${img.pageNumber}${dimInfo} [see attached]`;
}

/**
 * Build a multimodal user content array for the AI SDK.
 * Interleaves text and images so the model can associate img_id with actual image.
 * Each image label includes dimensions when available so the model knows the size
 * before seeing the image (important for layout decisions).
 */
export function buildVisionUserContent(
  userPrompt: string,
  images: Array<{ id: string; src: string; width?: number; height?: number }>,
): Array<{ type: 'text'; text: string } | { type: 'image'; image: string; mimeType?: string }> {
  const parts: Array<
    { type: 'text'; text: string } | { type: 'image'; image: string; mimeType?: string }
  > = [{ type: 'text', text: userPrompt }];
  if (images.length > 0) {
    parts.push({ type: 'text', text: '\n\n--- Attached Images ---' });
    for (const img of images) {
      let dimInfo = '';
      if (img.width && img.height) {
        const ratio = (img.width / img.height).toFixed(2);
        dimInfo = ` (${img.width}×${img.height}, 宽高比${ratio})`;
      }
      parts.push({ type: 'text', text: `\n**${img.id}**${dimInfo}:` });
      // Strip data URI prefix — AI SDK only accepts http(s) URLs or raw base64
      const dataUriMatch = img.src.match(/^data:([^;]+);base64,(.+)$/);
      if (dataUriMatch) {
        parts.push({
          type: 'image',
          image: dataUriMatch[2],
          mimeType: dataUriMatch[1],
        });
      } else {
        parts.push({ type: 'image', image: img.src });
      }
    }
  }
  return parts;
}
