import { useNavigate } from 'react-router';
import { useAttributeDefs } from '@/features/attributes/queries';
import { CreateUserDialog } from '../components/create-user-dialog';

/** `/users/new` route: renders the create dialog and returns to the list on close. */
export function NewUserPage() {
  const navigate = useNavigate();
  const { data: defs } = useAttributeDefs();

  return (
    <CreateUserDialog
      open
      onOpenChange={(open) => {
        if (!open) navigate('/users');
      }}
      defs={defs ?? []}
    />
  );
}
