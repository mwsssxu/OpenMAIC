#!/usr/bin/env node
/**
 * 软著源代码文档生成脚本
 *
 * 生成格式：前30页 + 后30页，每页50行，带页眉
 * 页眉格式：软件名称 版本号  第 X 页
 */

const fs = require('fs');
const path = require('path');

// ============ 配置 ============
const SOFTWARE_NAME = '侧伴移动端软件';
const VERSION = 'V1.0.0';
const LINES_PER_PAGE = 50;
const FRONT_PAGES = 30;
const BACK_PAGES = 30;
const TOTAL_PAGES = FRONT_PAGES + BACK_PAGES;

const MOBILE_ROOT = path.resolve(__dirname, '../../packages/mobile');
const OUTPUT_FILE = path.resolve(__dirname, '../../docs/copyright/source-code.md');

// 排除的文件模式
const EXCLUDE_PATTERNS = [
  /node_modules/,
  /\.next/,
  /dist/,
  /__tests__/,
  /\.expo/,
  /expo-env/,
  /\.d\.ts$/,
  /\.test\./,
  /\.spec\./,
  /babel\.config/,
  /metro\.config/,
  /webpack\.config/,
  /jest\.config/,
  /tsconfig/,
  /\.eslintrc/,
  /prettier/,
];

// 排序优先级
function getFilePriority(filePath) {
  const rel = path.relative(MOBILE_ROOT, filePath);
  if (rel.startsWith('app/_layout')) return 10;
  if (rel.startsWith('app/(tabs)/_layout')) return 11;
  if (rel.startsWith('app/(tabs)/index')) return 12;
  if (rel.startsWith('app/(tabs)/')) return 20;
  if (rel.startsWith('app/auth/')) return 30;
  if (rel.startsWith('app/classroom/')) return 31;
  if (rel.startsWith('app/')) return 35;
  if (rel.startsWith('components/')) return 40;
  if (rel.startsWith('lib/api-client/')) return 50;
  if (rel.startsWith('lib/auth/')) return 51;
  if (rel.startsWith('lib/types/')) return 52;
  if (rel.startsWith('lib/playback/')) return 53;
  if (rel.startsWith('lib/')) return 55;
  if (rel.startsWith('hooks/')) return 60;
  if (rel.startsWith('constants/')) return 70;
  return 80;
}

function collectSourceFiles() {
  const files = [];

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!EXCLUDE_PATTERNS.some(p => p.test(fullPath))) {
          walk(fullPath);
        }
      } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
        if (!EXCLUDE_PATTERNS.some(p => p.test(fullPath))) {
          files.push(fullPath);
        }
      }
    }
  }

  walk(MOBILE_ROOT);
  return files.sort((a, b) => getFilePriority(a) - getFilePriority(b));
}

function readSourceFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }
  return content;
}

function formatPageHeader(pageNumber) {
  return `${SOFTWARE_NAME} ${VERSION}  第 ${pageNumber} 页`;
}

function generateDocument() {
  console.log('扫描源代码文件...');
  const sourceFiles = collectSourceFiles();
  console.log(`找到 ${sourceFiles.length} 个源文件`);

  // 收集所有代码行
  const allLines = [];

  for (const file of sourceFiles) {
    const content = readSourceFile(file);
    const lines = content.split('\n');
    const rel = path.relative(MOBILE_ROOT, file);
    allLines.push(`// ====== 文件: ${rel} ======`);
    for (const line of lines) {
      allLines.push(line);
    }
  }

  const totalLines = allLines.length;
  console.log(`总代码行数: ${totalLines}`);
  console.log(`可生成页数: ${Math.floor(totalLines / LINES_PER_PAGE)}`);

  const frontLineCount = FRONT_PAGES * LINES_PER_PAGE; // 1500
  const backLineCount = BACK_PAGES * LINES_PER_PAGE; // 1500

  if (totalLines < frontLineCount + backLineCount) {
    console.error(`代码行数不足！需要 ${frontLineCount + backLineCount} 行，实际 ${totalLines} 行`);
    process.exit(1);
  }

  // 前半部分：从第1行开始
  const frontLines = allLines.slice(0, frontLineCount);
  // 后半部分：从末尾往前取
  const backLines = allLines.slice(totalLines - backLineCount);

  // 生成 Markdown
  const output = [];
  output.push(`# ${SOFTWARE_NAME} ${VERSION} 源代码`);
  output.push('');
  output.push(`<!-- 软件名称：${SOFTWARE_NAME} -->`);
  output.push(`<!-- 版本号：${VERSION} -->`);
  output.push(`<!-- 著作权人：【请填写著作权人名称】 -->`);
  output.push('');

  // 前半部分
  for (let page = 0; page < FRONT_PAGES; page++) {
    const pageNum = page + 1;
    output.push('---');
    output.push('');
    output.push(`**${formatPageHeader(pageNum)}**`);
    output.push('');
    output.push('```');

    const start = page * LINES_PER_PAGE;
    const end = start + LINES_PER_PAGE;
    const pageLines = frontLines.slice(start, end);

    for (const line of pageLines) {
      output.push(line);
    }

    output.push('```');
    output.push('');
  }

  // 后半部分
  for (let page = 0; page < BACK_PAGES; page++) {
    const pageNum = FRONT_PAGES + page + 1;
    output.push('---');
    output.push('');
    output.push(`**${formatPageHeader(pageNum)}**`);
    output.push('');

    output.push('```');

    const start = page * LINES_PER_PAGE;
    const end = start + LINES_PER_PAGE;
    const pageLines = backLines.slice(start, end);

    for (const line of pageLines) {
      output.push(line);
    }

    output.push('```');
    output.push('');
  }

  fs.writeFileSync(OUTPUT_FILE, output.join('\n'), 'utf-8');
  console.log(`\n源代码文档已生成: ${OUTPUT_FILE}`);
  console.log(`总页数: ${TOTAL_PAGES}`);
  console.log(`前 ${FRONT_PAGES} 页: 第1-${frontLineCount} 行`);
  console.log(`后 ${BACK_PAGES} 页: 第${totalLines - backLineCount + 1}-${totalLines} 行`);
}

generateDocument();