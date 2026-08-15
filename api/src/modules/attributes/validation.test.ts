import { describe, expect, test } from 'bun:test';
import { buildValueValidator } from './validation';

function parse(type: Parameters<typeof buildValueValidator>[0], config: object, value: unknown) {
  return buildValueValidator(type, config as never).safeParse(value);
}

describe('buildValueValidator', () => {
  test('string: plain, min/max length, regex', () => {
    expect(parse('string', {}, 'hello').success).toBe(true);
    expect(parse('string', {}, 42).success).toBe(false);

    expect(parse('string', { min: 2, max: 5 }, 'ab').success).toBe(true);
    expect(parse('string', { min: 2, max: 5 }, 'a').success).toBe(false);
    expect(parse('string', { min: 2, max: 5 }, 'abcdef').success).toBe(false);

    expect(parse('string', { regex: '^[0-9]+$' }, '123').success).toBe(true);
    expect(parse('string', { regex: '^[0-9]+$' }, '12a').success).toBe(false);
  });

  test('number: strict JSON number with inclusive bounds', () => {
    expect(parse('number', {}, 25).success).toBe(true);
    expect(parse('number', {}, '25').success).toBe(false);
    expect(parse('number', {}, true).success).toBe(false);

    expect(parse('number', { min: 0, max: 150 }, 0).success).toBe(true);
    expect(parse('number', { min: 0, max: 150 }, 150).success).toBe(true);
    expect(parse('number', { min: 0, max: 150 }, -1).success).toBe(false);
    expect(parse('number', { min: 0, max: 150 }, 151).success).toBe(false);
  });

  test('bool: boolean only', () => {
    expect(parse('bool', {}, true).success).toBe(true);
    expect(parse('bool', {}, false).success).toBe(true);
    expect(parse('bool', {}, 'true').success).toBe(false);
    expect(parse('bool', {}, 1).success).toBe(false);
  });

  test('date: strict real calendar dates', () => {
    expect(parse('date', {}, '2025-08-15').success).toBe(true);
    expect(parse('date', {}, '2025-02-28').success).toBe(true);
    expect(parse('date', {}, '2025-02-30').success).toBe(false); // impossible day
    expect(parse('date', {}, '2025-13-01').success).toBe(false); // impossible month
    expect(parse('date', {}, '2025-8-15').success).toBe(false); // zero-padding required
    expect(parse('date', {}, 'not-a-date').success).toBe(false);
  });

  test('select: value must be one of the configured options', () => {
    expect(parse('select', { options: ['男', '女'] }, '男').success).toBe(true);
    expect(parse('select', { options: ['男', '女'] }, '未知').success).toBe(false);
    expect(parse('select', { options: ['男', '女'] }, 1).success).toBe(false);
  });
});
