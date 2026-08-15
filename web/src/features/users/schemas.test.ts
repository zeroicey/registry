import { describe, expect, it } from 'vitest';
import { toCreateUserInput, toUpdateUserInput, userBaseSchema } from './schemas';

describe('userBaseSchema', () => {
  it('accepts a valid realName with a blank code', () => {
    expect(userBaseSchema.safeParse({ realName: '张三', code: '' }).success).toBe(true);
  });

  it('trims realName and rejects empty', () => {
    expect(userBaseSchema.safeParse({ realName: '  ', code: '' }).success).toBe(false);
    expect(userBaseSchema.safeParse({ realName: ' 张三 ', code: '' }).data?.realName).toBe('张三');
  });

  it('rejects realName longer than 100 chars', () => {
    expect(userBaseSchema.safeParse({ realName: 'a'.repeat(101), code: '' }).success).toBe(false);
  });

  it('accepts a valid code and rejects invalid characters', () => {
    expect(userBaseSchema.safeParse({ realName: '张三', code: '1001' }).success).toBe(true);
    expect(userBaseSchema.safeParse({ realName: '张三', code: 'A-1_x' }).success).toBe(true);
    expect(userBaseSchema.safeParse({ realName: '张三', code: '1001 ' }).success).toBe(true); // trimmed
    expect(userBaseSchema.safeParse({ realName: '张三', code: '100 1' }).success).toBe(false);
    expect(userBaseSchema.safeParse({ realName: '张三', code: '中文' }).success).toBe(false);
  });

  it('rejects code longer than 64 chars', () => {
    expect(userBaseSchema.safeParse({ realName: '张三', code: 'a'.repeat(65) }).success).toBe(
      false,
    );
  });
});

describe('toCreateUserInput / toUpdateUserInput', () => {
  it('maps blank code to null', () => {
    expect(toCreateUserInput({ realName: '张三', code: '' }).code).toBeNull();
    expect(toUpdateUserInput({ realName: '张三', code: '' }).code).toBeNull();
  });

  it('keeps a non-blank code verbatim', () => {
    expect(toCreateUserInput({ realName: '张三', code: '1001' }).code).toBe('1001');
    expect(toUpdateUserInput({ realName: '张三', code: '1001' }).code).toBe('1001');
  });
});
