import { create } from 'zustand';

/**
 * 当前名录作用域 —— 贯穿人员/属性/数据源三个页面的「工作区」选择。
 * 存储在客户端（zustand），由导航栏的名录选择器驱动。
 */
export type CollectionScope =
  | { kind: 'all' }
  | { kind: 'global' }
  | { kind: 'collection'; id: number };

interface CollectionState {
  scope: CollectionScope;
  setScope: (scope: CollectionScope) => void;
}

export const useCollectionStore = create<CollectionState>((set) => ({
  scope: { kind: 'all' },
  setScope: (scope) => set({ scope }),
}));

/** 序列化为 <select> 的字符串值。 */
export function scopeToValue(scope: CollectionScope): string {
  if (scope.kind === 'all') return 'all';
  if (scope.kind === 'global') return 'global';
  return `collection:${scope.id}`;
}

/** 从 <select> 字符串值解析回作用域。 */
export function valueToScope(value: string): CollectionScope {
  if (value === 'global') return { kind: 'global' };
  if (value.startsWith('collection:')) {
    const id = Number(value.slice('collection:'.length));
    if (Number.isInteger(id) && id > 0) return { kind: 'collection', id };
  }
  return { kind: 'all' };
}

/** 用于 users / source-files 列表过滤的 collectionId（无过滤 = undefined）。 */
export function scopeToCollectionId(scope: CollectionScope): number | undefined {
  return scope.kind === 'collection' ? scope.id : undefined;
}

/** 属性列表查询参数：all=全部；global=仅全局；collection=全局∪某名录。 */
export function scopeToAttributesQuery(scope: CollectionScope): {
  scope: 'all' | 'global' | 'collection';
  collectionId?: number;
} {
  if (scope.kind === 'global') return { scope: 'global' };
  if (scope.kind === 'collection') return { scope: 'collection', collectionId: scope.id };
  return { scope: 'all' };
}

/** 创建属性/人员时应归属的名录 id（all/global 场景下为 undefined → 全局）。 */
export function scopeToCreateCollectionId(scope: CollectionScope): number | undefined {
  return scope.kind === 'collection' ? scope.id : undefined;
}
