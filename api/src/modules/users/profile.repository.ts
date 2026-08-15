import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@/db/connection';
import {
  type AttributeValue,
  attributes,
  attributeValueHistory,
  attributeValues,
} from '@/db/schema';
import type { ProfileEntry } from './users.types';

/** attribute_values row joined with its (active) attribute metadata. */
export interface AssembledProfileValue {
  attributeId: number;
  key: string;
  value: AttributeValue['value'];
  updatedAt: Date;
}

export interface ProfileRepository {
  /** Values for a user joined with active attribute keys — drives profile assembly. */
  getAssembled(userId: number): Promise<AssembledProfileValue[]>;
  /**
   * Upsert values and record change history atomically.
   * Values that are deep-equal to the current row are skipped (no-op, no history entry).
   */
  patchValues(userId: number, entries: ProfileEntry[]): Promise<void>;
}

function valuesEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export class DrizzleProfileRepository implements ProfileRepository {
  async getAssembled(userId: number): Promise<AssembledProfileValue[]> {
    return db
      .select({
        attributeId: attributeValues.attributeId,
        key: attributes.key,
        value: attributeValues.value,
        updatedAt: attributeValues.updatedAt,
      })
      .from(attributeValues)
      .innerJoin(attributes, eq(attributeValues.attributeId, attributes.id))
      .where(and(eq(attributeValues.userId, userId), isNull(attributes.deletedAt)))
      .orderBy(attributeValues.updatedAt);
  }

  async patchValues(userId: number, entries: ProfileEntry[]): Promise<void> {
    if (entries.length === 0) return;

    await db.transaction(async (tx) => {
      const attributeIds = [...new Set(entries.map((e) => e.attributeId))];
      const existing = await tx
        .select()
        .from(attributeValues)
        .where(
          and(
            eq(attributeValues.userId, userId),
            inArray(attributeValues.attributeId, attributeIds),
          ),
        );
      const current = new Map(existing.map((row) => [row.attributeId, row.value]));

      const now = new Date();
      for (const entry of entries) {
        const oldValue = current.get(entry.attributeId);
        if (oldValue !== undefined && valuesEqual(oldValue, entry.value)) continue;

        await tx
          .insert(attributeValues)
          .values({ userId, attributeId: entry.attributeId, value: entry.value, updatedAt: now })
          .onConflictDoUpdate({
            target: [attributeValues.userId, attributeValues.attributeId],
            set: { value: entry.value, updatedAt: now },
          });

        await tx.insert(attributeValueHistory).values({
          userId,
          attributeId: entry.attributeId,
          oldValue: oldValue ?? null,
          newValue: entry.value,
          changedAt: now,
        });
      }
    });
  }
}

export const profileRepository: ProfileRepository = new DrizzleProfileRepository();
