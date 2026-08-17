import { z } from 'zod';

/**
 * User form schemas — the single source of truth for the users feature,
 * shared by react-hook-form resolvers and API request types.
 */

/**
 * Business code (e.g. employee ID). Mirrors the backend `userCodeSchema`
 * (api/src/modules/users/users.schema.ts): 1–64 chars, letters/digits/underscores/dashes.
 * The form keeps an empty string for "unset" and submits `null` instead.
 */
export const userCodeSchema = z
  .string()
  .trim()
  .max(64, '身份证号最长 64 字')
  .regex(/^[A-Za-z0-9_-]*$/, '身份证号仅含字母、数字、下划线与连字符');

/** Basic-info form: realName is required, code may be blank (→ null on submit). */
export const userBaseSchema = z.object({
  realName: z.string().trim().min(1, '请输入姓名').max(100, '姓名最长 100 字'),
  code: userCodeSchema,
});

export type UserBaseFormValues = z.infer<typeof userBaseSchema>;

/**
 * Create-user form: basic info + a flat `profile` object. The profile is
 * validated dynamically against `attributes.config` at submit time via
 * `buildProfileSchema` (the attribute definitions are runtime data).
 */
export const createUserFormSchema = userBaseSchema.extend({
  profile: z.record(z.string(), z.unknown()),
});

export type CreateUserFormValues = z.infer<typeof createUserFormSchema>;

/** API payloads (assembled from validated form values). */
export interface CreateUserInput {
  realName: string;
  code: string | null;
  /** 创建时所在的名录（初始成员关系 + profile 解析作用域）。 */
  collectionId?: number;
  profiles?: Record<string, unknown>;
}

export interface UpdateUserInput {
  realName?: string;
  code?: string | null;
}

export interface UpdateProfileInput {
  profiles: Record<string, unknown>;
  /** 解析 key 的作用域：不传 = 仅全局属性；传 = 全局 ∪ 该名录。 */
  collectionId?: number;
}

/** Trim + map blank code to null, and empty realName is already rejected by the schema. */
export function toCreateUserInput(
  values: UserBaseFormValues,
): Pick<CreateUserInput, 'realName' | 'code'> {
  return {
    realName: values.realName,
    code: values.code === '' ? null : values.code,
  };
}

export function toUpdateUserInput(values: UserBaseFormValues): UpdateUserInput {
  return {
    realName: values.realName,
    code: values.code === '' ? null : values.code,
  };
}
