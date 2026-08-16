/**
 * User domain types — mirrors the backend contract
 * (api/src/modules/users/users.types.ts). Used only within the users feature.
 */

/** List item returned by `GET /users` (no profile — profile lives in the detail endpoint). */
export interface UserSummaryDto {
  id: number;
  realName: string;
  code: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Full user returned by `GET /users/:id` / `POST` / `PATCH`. */
export interface UserDto extends UserSummaryDto {
  /** Attribute values keyed by attribute business key. */
  profile: Record<string, unknown>;
}

/**
 * One resolved attribute filter for the list endpoint (query param value is
 * always a string). Special key `hasCode` filters on whether the national id
 * (users.code) is present: value 'true' = has one, 'false' = none.
 */
export interface AttributeFilterValue {
  key: string;
  value: string;
}

/** Query shape for the users list — filters are extra query params keyed by attribute key. */
export interface ListUsersParams {
  page: number;
  pageSize: number;
  search?: string | undefined;
  filters?: AttributeFilterValue[] | undefined;
}
