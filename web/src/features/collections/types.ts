/** 名录（集合）—— 后端 CollectionDto 的镜像（api/src/modules/collections/collections.types.ts）。 */
export interface CollectionDto {
  id: number;
  name: string;
  description: string | null;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}
