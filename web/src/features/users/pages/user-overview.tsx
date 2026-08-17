import { useParams } from 'react-router';
import { PageLoading } from '@/app/layout/page-loading';
import { useAttributeDefs } from '@/features/attributes/queries';
import { scopeToCollectionId, useCollectionStore } from '@/stores/collection-store';
import { AttributeValues } from '../components/attribute-values';
import { useUser } from '../queries';
import { UserBasicInfo } from './user-basic-info';

/**
 * 资料 Tab：基本信息 + 属性只读展示（无卡片盒子、无区块标题）。
 * 编辑入口在详情页头部的图标按钮。
 */
export function UserOverview() {
  const { id } = useParams();
  const userId = Number(id);
  const scope = useCollectionStore((s) => s.scope);
  const collectionId = scopeToCollectionId(scope);
  const { data: user, isLoading, isError } = useUser(userId, collectionId);
  const { data: defs } = useAttributeDefs(scope);

  if (isLoading) return <PageLoading />;
  if (isError || !user) {
    return <p className="text-sm text-muted-foreground">人员信息加载失败。</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      <UserBasicInfo user={user} />
      {defs !== undefined && defs.length > 0 ? (
        <AttributeValues defs={defs} profile={user.profile} />
      ) : (
        <p className="text-sm text-muted-foreground">还没有可展示的属性字段。</p>
      )}
    </div>
  );
}
