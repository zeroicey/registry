import { FolderIcon } from 'lucide-react';
import {
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectPopup,
  SelectRoot,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { scopeToValue, useCollectionStore, valueToScope } from '@/stores/collection-store';
import { useCollections } from '../queries';

/**
 * 名录工作区选择器：全部名录 / 全局属性 / 各名录。
 * 挂在导航栏，驱动人员、属性、数据源三个页面的过滤作用域。
 */
export function CollectionSelect() {
  const { scope, setScope } = useCollectionStore();
  const { data: collections } = useCollections();

  const value = scopeToValue(scope);
  const selectedName =
    scope.kind === 'all'
      ? '全部名录'
      : scope.kind === 'global'
        ? '全局属性'
        : (collections?.find((c) => c.id === scope.id)?.name ?? '名录');

  return (
    <SelectRoot value={value} onValueChange={(v) => setScope(valueToScope(v as string))}>
      <SelectTrigger aria-label="选择名录" className="w-40">
        <FolderIcon className="size-4 text-muted-foreground" aria-hidden="true" />
        <SelectValue placeholder="选择名录">{selectedName}</SelectValue>
      </SelectTrigger>
      <SelectPopup>
        <SelectGroup>
          <SelectLabel>作用域</SelectLabel>
          <SelectItem value="all">全部名录</SelectItem>
          <SelectItem value="global">全局属性</SelectItem>
        </SelectGroup>
        {(collections ?? []).length > 0 && (
          <SelectGroup>
            <SelectLabel>名录</SelectLabel>
            {(collections ?? []).map((c) => (
              <SelectItem key={c.id} value={`collection:${c.id}`}>
                {c.name}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
      </SelectPopup>
    </SelectRoot>
  );
}
