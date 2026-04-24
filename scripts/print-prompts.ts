/**
 * 打印所有提示词模版内容
 * 
 * 用法：pnpm exec tsx scripts/print-prompts.ts
 */

import { loadPrompt, PROMPT_IDS, loadSnippet } from '../lib/generation/prompts';
import { clearPromptCache } from '../lib/generation/prompts/loader';

// 清除缓存以确保读取最新内容
clearPromptCache();

console.log('\n' + '='.repeat(80));
console.log('📋 OpenMAIC 提示词模版总览');
console.log('='.repeat(80) + '\n');

// 打印所有模版
const promptIds = Object.values(PROMPT_IDS);

for (const promptId of promptIds) {
  const prompt = loadPrompt(promptId as any);
  
  console.log('\n' + '-'.repeat(80));
  console.log(`📁 模版 ID: ${promptId}`);
  console.log('-'.repeat(80));
  
  if (prompt) {
    console.log('\n📝 SYSTEM PROMPT (系统提示):\n');
    console.log(prompt.systemPrompt);
    
    if (prompt.userPromptTemplate) {
      console.log('\n📝 USER PROMPT TEMPLATE (用户提示模版):\n');
      console.log(prompt.userPromptTemplate);
    } else {
      console.log('\n⚠️  无用户提示模版 (user.md)\n');
    }
  } else {
    console.log(`❌ 加载失败: ${promptId}`);
  }
}

// 打印共用片段
console.log('\n' + '-'.repeat(80));
console.log('📦 共用代码片段 (snippets)');
console.log('-'.repeat(80) + '\n');

try {
  const jsonOutputRules = loadSnippet('json-output-rules' as any);
  console.log('📄 json-output-rules.md:\n');
  console.log(jsonOutputRules);
} catch {
  console.log('⚠️  json-output-rules 片段未找到');
}

console.log('\n' + '='.repeat(80));
console.log('✅ 打印完成');
console.log('='.repeat(80) + '\n');