import { describe, expect, test } from 'vitest';
import { parseListScene } from './users-page';

describe('parseListScene', () => {
  test('空参数返回默认场景', () => {
    expect(parseListScene(new URLSearchParams())).toEqual({
      search: '',
      page: 1,
      filters: [],
    });
  });

  test('解析 search 与 page', () => {
    expect(parseListScene(new URLSearchParams('search=wangbo&page=3'))).toEqual({
      search: 'wangbo',
      page: 3,
      filters: [],
    });
  });

  test('非法 page 回退到 1', () => {
    expect(parseListScene(new URLSearchParams('page=abc')).page).toBe(1);
    expect(parseListScene(new URLSearchParams('page=0')).page).toBe(1);
    expect(parseListScene(new URLSearchParams('page=-2')).page).toBe(1);
  });

  test('非保留参数解析为属性筛选（含 hasCode）', () => {
    const scene = parseListScene(new URLSearchParams('gender=男&hasCode=true'));
    expect(scene.filters).toEqual([
      { key: 'gender', value: '男' },
      { key: 'hasCode', value: 'true' },
    ]);
  });

  test('保留键不被当作筛选', () => {
    const scene = parseListScene(new URLSearchParams('search=x&page=2&gender=女'));
    expect(scene.search).toBe('x');
    expect(scene.page).toBe(2);
    expect(scene.filters).toEqual([{ key: 'gender', value: '女' }]);
  });
});
