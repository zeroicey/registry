import type { User } from '@/db/schema';
import type { AttributeRepository } from '@/modules/attributes/attributes.service';
import { attributeRepository } from '@/modules/attributes/attributes.service';
import { buildValueValidator } from '@/modules/attributes/validation';
import { AppError } from '@/shared/errors';
import { Msg } from '@/shared/messages';
import { type ProfileRepository, profileRepository } from './profile.repository';
import { type UserRepository, userRepository } from './users.repository';
import { RESERVED_USER_QUERY_KEYS } from './users.schema';
import type {
  AttributeFilter,
  CreateUserInput,
  ListUsersQuery,
  ProfileEntry,
  UpdateProfileInput,
  UpdateUserInput,
  UserDto,
  UserSummaryDto,
} from './users.types';

export class UserService {
  constructor(
    private readonly users: UserRepository,
    private readonly profiles: ProfileRepository,
    private readonly attributes: AttributeRepository,
  ) {}

  async create(input: CreateUserInput): Promise<UserDto> {
    const entries = await this.validateProfileEntries(input.profiles ?? {});
    const user = await this.users.createWithProfile(
      { realName: input.realName, code: input.code ?? null },
      entries,
    );
    return this.assemble(user);
  }

  async get(id: number): Promise<UserDto> {
    const user = await this.requireUser(id);
    return this.assemble(user);
  }

  async list(
    query: ListUsersQuery,
  ): Promise<{ items: UserSummaryDto[]; total: number; page: number; pageSize: number }> {
    const options: {
      page: number;
      pageSize: number;
      attributeFilters: AttributeFilter[];
      search?: string;
    } = {
      page: query.page,
      pageSize: query.pageSize,
      attributeFilters: await this.resolveAttributeFilters(query),
    };
    if (query.search !== undefined) options.search = query.search;
    const { items, total } = await this.users.list(options);
    return { items: items.map(toSummaryDto), total, page: query.page, pageSize: query.pageSize };
  }

  async update(id: number, input: UpdateUserInput): Promise<UserDto> {
    const updated = await this.users.update(id, {
      ...(input.realName !== undefined ? { realName: input.realName } : {}),
      ...(input.code !== undefined ? { code: input.code } : {}),
    });
    if (!updated) throw new AppError('USER_NOT_FOUND', Msg.USER_NOT_FOUND);
    return this.assemble(updated);
  }

  async remove(id: number): Promise<void> {
    const found = await this.users.softDelete(id);
    if (!found) throw new AppError('USER_NOT_FOUND', Msg.USER_NOT_FOUND);
  }

  /** Merge-patch a profile: validate against attribute configs, then upsert + history atomically. */
  async patchProfile(id: number, input: UpdateProfileInput): Promise<UserDto> {
    const user = await this.requireUser(id);
    const entries = await this.validateProfileEntries(input.profiles);
    await this.profiles.patchValues(user.id, entries);
    return this.assemble(user);
  }

  // ── internals ──

  private async requireUser(id: number) {
    const user = await this.users.findById(id);
    if (!user) throw new AppError('USER_NOT_FOUND', Msg.USER_NOT_FOUND);
    return user;
  }

  private async assemble(user: User): Promise<UserDto> {
    const values = await this.profiles.getAssembled(user.id);
    const profile: Record<string, unknown> = {};
    for (const v of values) profile[v.key] = v.value;
    return { ...toSummaryDto(user), profile };
  }

  /** Validates profile values against the active attribute definitions (keys + per-type rules). */
  private async validateProfileEntries(profiles: Record<string, unknown>): Promise<ProfileEntry[]> {
    const keys = Object.keys(profiles);
    if (keys.length === 0) return [];

    const found = await this.attributes.findByKeys(keys);
    const byKey = new Map(found.map((a) => [a.key, a]));

    const unknown = keys.filter((k) => !byKey.has(k));
    if (unknown.length > 0) {
      throw new AppError('VALIDATION', Msg.VALIDATION_ERROR, 400, {
        message: 'unknown attribute keys',
        keys: unknown,
      });
    }

    const entries: ProfileEntry[] = [];
    const issues: { key: string; message: string }[] = [];
    for (const key of keys) {
      const attr = byKey.get(key);
      if (!attr) continue; // unreachable: unknown keys are rejected above
      const result = buildValueValidator(attr.type, attr.config).safeParse(profiles[key]);
      if (!result.success) {
        issues.push({ key, message: result.error.issues.map((i) => i.message).join('; ') });
      } else {
        entries.push({ attributeId: attr.id, value: result.data });
      }
    }
    if (issues.length > 0) {
      throw new AppError('VALIDATION', Msg.VALIDATION_ERROR, 400, {
        message: 'invalid attribute values',
        issues,
      });
    }
    return entries;
  }

  /** Turns extra query params (?gender=男) into resolved attribute filters. */
  private async resolveAttributeFilters(query: ListUsersQuery): Promise<AttributeFilter[]> {
    const filters: AttributeFilter[] = [];
    for (const [key, value] of Object.entries(query)) {
      if ((RESERVED_USER_QUERY_KEYS as readonly string[]).includes(key)) continue;
      if (typeof value !== 'string') {
        throw new AppError('BAD_REQUEST', Msg.BAD_REQUEST, 400, {
          message: `attribute filter "${key}" must be a single value`,
        });
      }
      const attr = await this.attributes.findByKey(key);
      if (!attr) {
        throw new AppError('BAD_REQUEST', Msg.BAD_REQUEST, 400, {
          message: `unknown attribute filter: ${key}`,
        });
      }
      filters.push({ attributeId: attr.id, value });
    }
    return filters;
  }
}

export function toSummaryDto(user: {
  id: number;
  realName: string;
  code: string | null;
  createdAt: Date;
  updatedAt: Date;
}): UserSummaryDto {
  return {
    id: user.id,
    realName: user.realName,
    code: user.code,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export const userService = new UserService(userRepository, profileRepository, attributeRepository);
