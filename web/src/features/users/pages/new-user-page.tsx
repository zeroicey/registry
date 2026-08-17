import { useNavigate } from 'react-router';
import { useAttributeDefs } from '@/features/attributes/queries';
import {
  type CollectionScope,
  scopeToCollectionId,
  useCollectionStore,
} from '@/stores/collection-store';
import { CreateUserDialog } from '../components/create-user-dialog';

/** `/users/new` route: renders the create dialog and returns to the list on close. */
export function NewUserPage() {
  const navigate = useNavigate();
  const scope = useCollectionStore((s) => s.scope);
  const collectionId = scopeToCollectionId(scope);
  // 创建表单的属性字段必须与后端创建时的解析作用域一致：
  // 选定了名录 → 全局∪该名录；未选 → 仅全局（创建无名录用户只能设全局属性）。
  const createScope: CollectionScope = collectionId !== undefined ? scope : { kind: 'global' };
  const { data: defs } = useAttributeDefs(createScope);

  return (
    <CreateUserDialog
      open
      onOpenChange={(open) => {
        if (!open) navigate('/users');
      }}
      defs={defs ?? []}
      {...(collectionId !== undefined ? { collectionId } : {})}
    />
  );
}
