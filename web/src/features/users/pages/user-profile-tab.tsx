import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2Icon, SaveIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useParams } from 'react-router';
import { z } from 'zod';
import { PageLoading } from '@/app/layout/page-loading';
import { AttributeFields, buildProfileSchema } from '@/components/common/attribute-form';
import { Button } from '@/components/ui/button';
import { useAttributeDefs } from '@/features/attributes/queries';
import { useUpdateProfile, useUser } from '../queries';
import type { UpdateProfileInput } from '../schemas';

interface ProfileFormValues {
  profile: Record<string, unknown>;
}

/** Deep compare against the backend's own `valuesEqual` semantics. */
function jsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Merge-patch payload: only keys whose normalized value differs from the
 * current profile are submitted (blank inputs are dropped entirely).
 */
function buildProfilePatch(
  original: Record<string, unknown>,
  parsed: Record<string, unknown>,
): UpdateProfileInput['profiles'] {
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (value === undefined) continue; // left blank — not touched
    if (!jsonEqual(value, original[key])) patch[key] = value;
  }
  return patch;
}

/** 属性 Tab：按属性定义动态渲染表单，保存时只提交改动项（PATCH /users/:id/profile）。 */
export function UserProfileTab() {
  const { id } = useParams();
  const userId = Number(id);
  const { data: user, isLoading, isError } = useUser(userId);
  const { data: defs } = useAttributeDefs();

  const profileSchema = useMemo(() => buildProfileSchema(defs ?? []), [defs]);
  // Wrap the dynamic profile schema so the resolver operates on the whole form.
  const resolver = useMemo(
    () => zodResolver(z.object({ profile: profileSchema })),
    [profileSchema],
  );

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver,
    defaultValues: { profile: {} },
    values: user ? { profile: { ...user.profile } } : { profile: {} },
  });

  const updateProfile = useUpdateProfile();

  const onSubmit = handleSubmit((values) => {
    const result = profileSchema.safeParse(values.profile);
    if (!result.success) return;
    const patch = buildProfilePatch(user?.profile ?? {}, result.data);
    if (Object.keys(patch).length === 0) return;
    updateProfile.mutate({ id: userId, input: { profiles: patch } });
  });

  if (isLoading) return <PageLoading />;
  if (isError || !user) {
    return <p className="text-sm text-muted-foreground">人员信息加载失败。</p>;
  }

  const hasFields = defs !== undefined && defs.length > 0;

  return (
    <form onSubmit={onSubmit} className="flex max-w-lg flex-col gap-4">
      {hasFields ? (
        <div className="rounded-lg border bg-card p-4">
          <AttributeFields
            defs={defs}
            control={control}
            errors={errors.profile}
            namePrefix="profile"
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">还没有可编辑的属性字段。</p>
      )}
      {hasFields && (
        <div>
          <Button type="submit" disabled={updateProfile.isPending}>
            {updateProfile.isPending ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <SaveIcon className="size-4" />
            )}
            保存属性
          </Button>
        </div>
      )}
    </form>
  );
}
