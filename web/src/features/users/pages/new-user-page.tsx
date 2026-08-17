import { useNavigate } from 'react-router';
import { useAttributeDefs } from '@/features/attributes/queries';
import { scopeToCollectionId, useCollectionStore } from '@/stores/collection-store';
import { CreateUserDialog } from '../components/create-user-dialog';

/** `/users/new` route: renders the create dialog and returns to the list on close. */
export function NewUserPage() {
  const navigate = useNavigate();
  const scope = useCollectionStore((s) => s.scope);
  const { data: defs } = useAttributeDefs(scope);
  const collectionId = scopeToCollectionId(scope);

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
