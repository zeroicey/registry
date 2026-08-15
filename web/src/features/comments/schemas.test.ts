import { describe, expect, it } from 'vitest';
import { commentContentSchema } from './schemas';

describe('commentContentSchema', () => {
  it('trims content and rejects empty/whitespace-only', () => {
    expect(commentContentSchema.safeParse('  ').success).toBe(false);
    expect(commentContentSchema.safeParse('').success).toBe(false);
    expect(commentContentSchema.safeParse(' 你好 ').data).toBe('你好');
  });

  it('accepts a valid content up to 2000 chars', () => {
    expect(commentContentSchema.safeParse('正常留言内容').success).toBe(true);
    expect(commentContentSchema.safeParse('a'.repeat(2000)).success).toBe(true);
  });

  it('rejects content longer than 2000 chars', () => {
    expect(commentContentSchema.safeParse('a'.repeat(2001)).success).toBe(false);
  });
});
