import { pinyin } from 'pinyin-pro';

// ---------------------------------------------------------------------------
// 人员姓名拼音派生列（全拼 + 首字母，用于拼音检索）。
// 纯函数，无 DB / IO 依赖，便于单元测试。配置对齐 serenique 已验证过的
// pinyin-pro v3.x 参数：
//   - toneType 'none'     输出纯 ASCII（去掉声调，输入要能匹配到"wangbo"）
//   - separator ''        生成紧凑连续串（"wangbo" 而非 "wang bo"）
//   - nonZh 'consecutive' 英文/数字原样保留（输入英文名也能搜到）
//   - v: true             ü 映射为 v（输入 "lv" 能匹配「吕」）
//   - pattern 'first'     首字母模式（"王博" → "wb"）
// ---------------------------------------------------------------------------

const normalizePinyin = (s: string): string => s.replace(/\s+/g, ' ').trim().toLowerCase();

export type PinyinColumns = { pinyin: string; pinyinInitial: string };

/** 由姓名计算全拼与首字母两个派生检索列。 */
export function toPinyinColumns(name: string): PinyinColumns {
  return {
    pinyin: normalizePinyin(
      pinyin(name, {
        toneType: 'none',
        separator: '',
        nonZh: 'consecutive',
        v: true,
      }),
    ),
    pinyinInitial: normalizePinyin(
      pinyin(name, {
        pattern: 'first',
        toneType: 'none',
        separator: '',
        nonZh: 'consecutive',
        v: true,
      }),
    ),
  };
}
