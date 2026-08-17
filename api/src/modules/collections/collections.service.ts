import { AppError } from '@/shared/errors';
import { Msg } from '@/shared/messages';
import { toCollectionDto } from './collections.mappers';
import { type CollectionRepository, collectionRepository } from './collections.repository';
import type {
  AddCollectionMembersInput,
  CollectionDto,
  CreateCollectionInput,
  ListCollectionsQuery,
  PaginatedResult,
  UpdateCollectionInput,
} from './collections.types';

export class CollectionService {
  constructor(private readonly repo: CollectionRepository) {}

  async list(query: ListCollectionsQuery): Promise<PaginatedResult<CollectionDto>> {
    const { items, total } = await this.repo.list(query);
    return {
      items: items.map(toCollectionDto),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(id: number): Promise<CollectionDto> {
    const collection = await this.requireCollection(id);
    return toCollectionDto({ ...collection, memberCount: await this.repo.countMembers(id) });
  }

  async create(input: CreateCollectionInput): Promise<CollectionDto> {
    const row = await this.repo.insert({
      name: input.name,
      description: input.description ?? null,
    });
    return toCollectionDto({ ...row, memberCount: 0 });
  }

  async update(id: number, input: UpdateCollectionInput): Promise<CollectionDto> {
    await this.requireCollection(id);
    const updated = await this.repo.update(id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
    });
    if (!updated) throw new AppError('COLLECTION_NOT_FOUND', Msg.COLLECTION_NOT_FOUND);
    return toCollectionDto({ ...updated, memberCount: await this.repo.countMembers(id) });
  }

  async remove(id: number): Promise<void> {
    const removed = await this.repo.softDelete(id);
    if (!removed) throw new AppError('COLLECTION_NOT_FOUND', Msg.COLLECTION_NOT_FOUND);
  }

  async addMembers(id: number, input: AddCollectionMembersInput): Promise<CollectionDto> {
    await this.requireCollection(id);
    const unique = [...new Set(input.userIds)];
    const existing = await this.repo.findActiveUserIds(unique);
    const missing = unique.filter((uid) => !existing.includes(uid));
    if (missing.length > 0) {
      throw new AppError('VALIDATION', Msg.VALIDATION_ERROR, 400, {
        message: 'unknown or deleted user ids',
        ids: missing,
      });
    }
    await this.repo.addMembers(id, unique);
    const collection = await this.requireCollection(id);
    return toCollectionDto({ ...collection, memberCount: await this.repo.countMembers(id) });
  }

  async removeMember(id: number, userId: number): Promise<void> {
    await this.requireCollection(id);
    await this.repo.removeMember(id, userId);
  }

  // ── internals ──

  private async requireCollection(id: number) {
    const collection = await this.repo.findById(id);
    if (!collection) throw new AppError('COLLECTION_NOT_FOUND', Msg.COLLECTION_NOT_FOUND);
    return collection;
  }
}

export const collectionService = new CollectionService(collectionRepository);
