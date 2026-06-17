/**
 * 题目数据相关的工具函数。
 *
 * 后端 question.options 的形态历史上不一致：
 *   - 老数据 / programming：array string[]，正解用 "A"/"B" 字母表达
 *   - 新数据 / 大部分 LLM 生成：dict {A:"内容", B:"内容"}
 *   - 极个别：单纯字符串（极端兜底）
 *
 * 这个 util 统一归一化为 [key, label][] 结构，配合 correct_answer 字段使用。
 *
 * key   = "A" / "B" / "C" / "D"（永远是字母，方便和 correct_answer 对齐）
 * label = 选项展示文案
 */

export type OptionEntry = [string, string];

/**
 * 把 question.options 解析成统一的 [key, label][] 结构。
 *
 * @returns 空数组表示该题没有选项（如 short_answer / coding）
 */
export function parseOptions(options: any): OptionEntry[] {
  if (!options) return [];

  // dict 形态: {A: "...", B: "..."}
  if (typeof options === 'object' && !Array.isArray(options)) {
    return Object.entries(options).map(([k, v]) => [String(k), String(v ?? '')]);
  }

  // array 形态: ["选项1", "选项2"] 或 [{label:"A", value:"选项1"}, ...]
  if (Array.isArray(options)) {
    const isKeyLike = (value: any) => /^[A-Z]$/.test(String(value ?? '').trim()) || /^\d+$/.test(String(value ?? '').trim());
    return options.map((v: any, i: number) => {
      if (typeof v === 'object' && v !== null) {
        const fallbackKey = String.fromCharCode(65 + i);
        const label = v.label;
        const value = v.value;
        let key = v.key ?? v.id ?? fallbackKey;
        let text = v.content ?? v.text ?? v.title;

        if (text == null && label != null && value != null) {
          if (isKeyLike(label) && !isKeyLike(value)) {
            key = label;
            text = value;
          } else if (isKeyLike(value) && !isKeyLike(label)) {
            key = value;
            text = label;
          } else {
            key = v.key ?? value ?? label ?? fallbackKey;
            text = label ?? value;
          }
        } else if (text == null) {
          text = label ?? value ?? '';
        }

        return [String(key), String(text)];
      }
      return [String.fromCharCode(65 + i), String(v ?? '')];
    });
  }

  // 异常 fallback
  return [];
}

/**
 * 用户提交的 picked 值可能是字母 ("A") 也可能是选项内容文本。
 * 给定 entries 和 picked，返回它对应的 key。
 */
export function pickedToKey(entries: OptionEntry[], picked: string | null | undefined): string | null {
  if (picked == null) return null;
  // 已经是字母 key
  if (entries.some(([k]) => k === picked)) return picked;
  // 是文案，反查 key
  const hit = entries.find(([, label]) => label === picked);
  return hit ? hit[0] : picked; // fallback：原样返回
}

/**
 * 难度标签的中文映射。
 */
export function difficultyLabel(d: string | null | undefined): string {
  switch (d) {
    case 'easy': return '简单';
    case 'medium': return '中等';
    case 'hard': return '困难';
    case 'basic': return '基础';
    case 'advanced': return '进阶';
    default: return d || '';
  }
}
