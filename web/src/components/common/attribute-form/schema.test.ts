import { describe, expect, it } from 'vitest';
import type { AttributeDef } from '@/types/attribute';
import { buildProfileSchema, buildValueSchema } from './schema';

function def(overrides: Partial<AttributeDef>): AttributeDef {
  return {
    id: 1,
    key: 'k',
    label: '字段',
    type: 'string',
    config: {},
    collectionId: null,
    createdAt: '2026-08-15T00:00:00Z',
    updatedAt: '2026-08-15T00:00:00Z',
    ...overrides,
  };
}

describe('buildValueSchema', () => {
  it('string: enforces min/max length', () => {
    const schema = buildValueSchema('string', { min: 2, max: 4 });
    expect(schema.safeParse('ab').success).toBe(true);
    expect(schema.safeParse('a').success).toBe(false);
    expect(schema.safeParse('abcde').success).toBe(false);
  });

  it('string: enforces regex pattern', () => {
    const schema = buildValueSchema('string', { regex: '^[A-Z]+$' });
    expect(schema.safeParse('ABC').success).toBe(true);
    expect(schema.safeParse('abc').success).toBe(false);
  });

  it('number: coerces string input and enforces bounds', () => {
    const schema = buildValueSchema('number', { min: 1, max: 10 });
    expect(schema.safeParse('5').success).toBe(true);
    expect(schema.safeParse('0').success).toBe(false);
    expect(schema.safeParse('11').success).toBe(false);
    expect(schema.safeParse('abc').success).toBe(false);
  });

  it('number: empty input becomes undefined (accepted by optional wrapper)', () => {
    const schema = buildValueSchema('number', {});
    expect(schema.safeParse('').data).toBeUndefined();
  });

  it('bool: only accepts booleans', () => {
    const schema = buildValueSchema('bool', {});
    expect(schema.safeParse(true).success).toBe(true);
    expect(schema.safeParse(false).success).toBe(true);
    expect(schema.safeParse('true').success).toBe(false);
  });

  it('date: accepts real calendar dates only', () => {
    const schema = buildValueSchema('date', {});
    expect(schema.safeParse('2025-08-15').success).toBe(true);
    expect(schema.safeParse('2025-02-30').success).toBe(false);
    expect(schema.safeParse('08/15/2025').success).toBe(false);
  });

  it('select: restricts to configured options', () => {
    const schema = buildValueSchema('select', { options: ['研发', '市场'] });
    expect(schema.safeParse('研发').success).toBe(true);
    expect(schema.safeParse('财务').success).toBe(false);
  });

  it('select: single option uses a literal schema', () => {
    const schema = buildValueSchema('select', { options: ['唯一'] });
    expect(schema.safeParse('唯一').success).toBe(true);
    expect(schema.safeParse('其他').success).toBe(false);
  });
});

describe('buildProfileSchema', () => {
  it('allows blank optional fields and rejects invalid values', () => {
    const schema = buildProfileSchema([
      def({ key: 'name', label: '姓名', type: 'string', config: {} }),
      def({ key: 'age', label: '年龄', type: 'number', config: {} }),
    ]);

    expect(schema.safeParse({ name: '张三', age: '' }).success).toBe(true);
    expect(schema.safeParse({ name: '', age: '' }).success).toBe(true);
    expect(schema.safeParse({ name: '张三', age: 'abc' }).success).toBe(false);
  });

  it('bool field keeps false as a valid value', () => {
    const schema = buildProfileSchema([
      def({ key: 'active', label: '在职', type: 'bool', config: {} }),
    ]);

    expect(schema.safeParse({ active: false }).success).toBe(true);
    expect(schema.safeParse({ active: true }).success).toBe(true);
  });

  it('select field enforces options', () => {
    const schema = buildProfileSchema([
      def({
        key: 'dept',
        label: '部门',
        type: 'select',
        config: { options: ['研发', '市场'] },
      }),
    ]);

    expect(schema.safeParse({ dept: '研发' }).success).toBe(true);
    // empty input = unset field, allowed without required config
    expect(schema.safeParse({ dept: '' }).success).toBe(true);
    expect(schema.safeParse({ dept: '其他' }).success).toBe(false);
    expect(schema.safeParse({ dept: '其他' }).success).toBe(false);
  });

  it('unknown keys in the input are stripped', () => {
    const schema = buildProfileSchema([def({ key: 'name', label: '姓名', type: 'string' })]);
    const result = schema.safeParse({ name: '张三', extra: 'x' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ name: '张三' });
    }
  });
});
