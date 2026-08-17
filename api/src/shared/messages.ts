/** Predefined message constants — keep user-facing strings in one place. */
export const Msg = {
  // ── generic ──
  OK: 'OK',
  CREATED: 'Created successfully',
  NO_CONTENT: 'No content',
  BAD_REQUEST: 'Bad request',
  UNAUTHORIZED: 'Unauthorized',
  FORBIDDEN: 'Forbidden',
  NOT_FOUND: 'Resource not found',
  CONFLICT: 'Conflict',
  PAYLOAD_TOO_LARGE: 'Payload too large',
  REQUEST_TIMEOUT: 'Request timed out',
  RATE_LIMITED: 'Too many requests, please slow down',
  SERVICE_UNAVAILABLE: 'Service unavailable',
  INTERNAL_ERROR: 'Internal server error',
  VALIDATION_ERROR: 'Validation failed',
  // ── health ──
  HEALTH_OK: 'Service is healthy',
  // ── users ──
  USER_NOT_FOUND: 'User not found',
  USER_CREATED: 'User created successfully',
  USER_FETCHED: 'User fetched successfully',
  USER_LISTED: 'Users fetched successfully',
  USER_UPDATED: 'User updated successfully',
  USER_DELETED: 'User deleted successfully',
  PROFILE_UPDATED: 'Profile updated successfully',
  // ── attributes ──
  ATTRIBUTE_NOT_FOUND: 'Attribute not found',
  ATTRIBUTE_CREATED: 'Attribute created successfully',
  ATTRIBUTE_FETCHED: 'Attribute fetched successfully',
  ATTRIBUTE_LISTED: 'Attributes fetched successfully',
  ATTRIBUTE_UPDATED: 'Attribute updated successfully',
  ATTRIBUTE_DELETED: 'Attribute deleted successfully',
  ATTRIBUTE_KEY_EXISTS: 'An active attribute with this key already exists',
  ATTRIBUTE_TYPE_LOCKED: 'Attribute type cannot be changed while values exist',
  // ── comments ──
  COMMENT_NOT_FOUND: 'Comment not found',
  COMMENT_CREATED: 'Comment created successfully',
  COMMENT_FETCHED: 'Comments fetched successfully',
  COMMENT_UPDATED: 'Comment updated successfully',
  COMMENT_DELETED: 'Comment deleted successfully',
  // ── files ──
  FILE_NOT_FOUND: 'File not found',
  FILE_REQUIRED: 'A file is required',
  FILE_UPLOADED: 'File uploaded successfully',
  FILE_LISTED: 'Files fetched successfully',
  FILE_DELETED: 'File deleted successfully',
  // ── source files ──
  SOURCE_FILE_NOT_FOUND: 'Source file not found',
  SOURCE_FILE_UPLOADED: 'Source file uploaded successfully',
  SOURCE_FILE_LISTED: 'Source files fetched successfully',
} as const satisfies Record<string, string>;

export type Message = (typeof Msg)[keyof typeof Msg];
