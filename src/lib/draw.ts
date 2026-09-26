/**
 * Fair, auditable random selection.
 *
 * Everything in this module is pure and synchronous so it can be unit tested
 * exhaustively. The database work lives in `src/server/services/draw-service.ts`.
 *
 * Why this is fair
 * ----------------
 *  1. The candidate pool is a *frozen snapshot* ordered by entry number, so the
 *     result cannot depend on database row order, insertion order or a timestamp.
 *  2. The pool is permuted with Fisher–Yates driven by a CSPRNG
 *     (`crypto.randomInt`, which uses rejection sampling and is therefore
 *     unbiased). Every candidate has exactly one chance to reach every position.
 *  3. Winners are handed out by walking that uniform permutation, so every
 *     eligible participant has an equal probability of being drawn.
 *  4. The permutation is derived from 32 bytes of server entropy. The entropy is
 *     hashed into a commitment *before* selection and published *after*
 *     completion, so anyone can recompute the permutation and verify the result
 *     (`verifySelection`).
 */

import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/** Unbiased integer generator: returns an integer in [0, maxExclusive). */
export type Rng = (maxExclusive: number) => number;

export const CRYPTO_ENTROPY_BYTES = 32;

/** CSPRNG-backed generator (rejection sampling, no modulo bias). */
export function cryptoRng(): Rng {
  return (maxExclusive: number) => {
    if (!Number.isInteger(maxExclusive) || maxExclusive < 1) {
      throw new RangeError(`maxExclusive must be a positive integer, received ${maxExclusive}`);
    }
    return randomInt(maxExclusive);
  };
}

/**
 * Deterministic generator seeded by hex entropy (HMAC-SHA256 counter mode).
 * Used so a published draw can be replayed and verified.
 */
/** Upper bound, matching Node's own `crypto.randomInt`. */
const MAX_RANGE = 2 ** 48 - 1;

export function seededRng(entropyHex: string): Rng {
  const seed = Buffer.from(entropyHex, "hex");
  if (seed.length < 16) {
    throw new RangeError("Selection entropy must be at least 16 bytes.");
  }
  let counter = 0;
  let buffer = Buffer.alloc(0);
  let offset = 0;

  /**
   * Reads `count` bytes from the HMAC keystream, refilling blocks as needed.
   * Requests are satisfied in order, so a sequence of reads of any widths
   * consumes the same keystream bytes as one wide read would.
   */
  const nextBytes = (count: number): Buffer => {
    const out = Buffer.alloc(count);
    let written = 0;
    while (written < count) {
      if (offset >= buffer.length) {
        buffer = createHmac("sha256", seed).update(String(counter++)).digest();
        offset = 0;
      }
      const take = Math.min(count - written, buffer.length - offset);
      buffer.copy(out, written, offset, offset + take);
      offset += take;
      written += take;
    }
    return out;
  };

  return (maxExclusive: number) => {
    if (!Number.isInteger(maxExclusive) || maxExclusive < 1) {
      throw new RangeError(`maxExclusive must be a positive integer, received ${maxExclusive}`);
    }
    if (maxExclusive > MAX_RANGE) {
      throw new RangeError(`maxExclusive must be at most ${MAX_RANGE}, received ${maxExclusive}`);
    }
    if (maxExclusive === 1) return 0;

    // Rejection sampling keeps the distribution exactly uniform, for any range
    // width. A pool larger than 256 candidates needs two bytes per draw, which
    // is why this reads a byte *width* rather than a single byte: sampling
    // `value % max` from one byte would have a limit of zero and never terminate.
    const width = Math.max(1, Math.ceil(Math.log2(maxExclusive) / 8));
    const range = 256 ** width;
    const limit = range - (range % maxExclusive);

    for (;;) {
      const value = nextBytes(width).readUIntBE(0, width);
      if (value < limit) return value % maxExclusive;
    }
  };
}

export function createSelectionEntropy(): string {
  return randomBytes(CRYPTO_ENTROPY_BYTES).toString("hex");
}

/** Fisher–Yates using the supplied generator. Does not mutate the input. */
export function shuffleWith<T>(items: readonly T[], rng: Rng): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = rng(i + 1);
    const a = out[i] as T;
    const b = out[j] as T;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

export interface PoolCandidate {
  registrationId: string;
  entryNumber: string;
}

export interface PrizeSlot {
  prizeId: string;
  prizeName: string;
  order: number;
  slotIndex: number;
}

/** Expand prizes into individual slots (a prize with quantity 3 yields 3 slots). */
export function buildPrizeSlots(
  prizes: ReadonlyArray<{ id: string; name: string; order: number; quantity: number }>,
): PrizeSlot[] {
  const slots: PrizeSlot[] = [];
  const ordered = [...prizes].sort((a, b) => a.order - b.order);
  for (const prize of ordered) {
    const quantity = Math.max(0, Math.trunc(prize.quantity));
    for (let i = 0; i < quantity; i += 1) {
      slots.push({
        prizeId: prize.id,
        prizeName: prize.name,
        order: prize.order,
        slotIndex: i,
      });
    }
  }
  return slots;
}

export interface WinnerAssignment {
  registrationId: string;
  entryNumber: string;
  prizeId: string;
  prizeName: string;
  prizeOrder: number;
  prizeSlotIndex: number;
}

export interface SelectionResult {
  assignments: WinnerAssignment[];
  /** Pool members who were eligible but not selected (for transparency). */
  notSelected: PoolCandidate[];
  /** Entry numbers in the exact order the permutation produced. */
  permutation: string[];
}

/**
 * Deterministically map a frozen pool + entropy + prize slots onto winners.
 *
 * @param pool        frozen, entry-number ordered candidates
 * @param slots       prize slots in configured order
 * @param entropy     32 bytes of CSPRNG output (hex)
 * @param isBlocked   optional predicate, e.g. "already won in this event when a
 *                    participant may only win once"
 */
export function selectWinners(options: {
  pool: readonly PoolCandidate[];
  slots: readonly PrizeSlot[];
  entropy: string;
  isBlocked?: (candidate: PoolCandidate) => boolean;
}): SelectionResult {
  const { pool, slots, entropy, isBlocked } = options;

  const ordered = [...pool].sort((a, b) =>
    a.entryNumber.localeCompare(b.entryNumber, "en", { numeric: true }),
  );
  const permutation = shuffleWith(ordered, seededRng(entropy));

  const assignments: WinnerAssignment[] = [];
  const taken = new Set<string>();

  for (const slot of slots) {
    const winner = permutation.find(
      (candidate) => !taken.has(candidate.registrationId) && !(isBlocked?.(candidate) ?? false),
    );
    if (!winner) break; // pool exhausted — the caller records the shortfall.
    taken.add(winner.registrationId);
    assignments.push({
      registrationId: winner.registrationId,
      entryNumber: winner.entryNumber,
      prizeId: slot.prizeId,
      prizeName: slot.prizeName,
      prizeOrder: slot.order,
      prizeSlotIndex: slot.slotIndex,
    });
  }

  return {
    assignments,
    notSelected: permutation.filter((candidate) => !taken.has(candidate.registrationId)),
    permutation: permutation.map((candidate) => candidate.entryNumber),
  };
}

/** SHA-256 over the ordered entry numbers — identifies the exact frozen pool. */
export function snapshotHash(entryNumbers: readonly string[]): string {
  const ordered = [...entryNumbers].sort((a, b) =>
    a.localeCompare(b, "en", { numeric: true }),
  );
  return `sha256:${createHash("sha256").update(ordered.join("\n")).digest("hex")}`;
}

/** Commitment published before selection, revealed after completion. */
export function selectionCommitHash(options: {
  drawId: string;
  poolHash: string;
  entropy: string;
}): string {
  return `sha256:${createHash("sha256")
    .update(`${options.drawId}\n${options.poolHash}\n${options.entropy}`)
    .digest("hex")}`;
}

export interface DrawIntegrityInput {
  drawId: string;
  poolEntryNumbers: readonly string[];
  entropy: string;
  expectedCommitHash: string;
}

/**
 * Independently recompute a draw from published data.
 * Returns the recomputed winners plus a commit-hash match flag.
 */
export function verifySelection(input: DrawIntegrityInput): {
  commitMatches: boolean;
  recomputedPermutation: string[];
  snapshotMatchesHash: string;
} {
  const commit = selectionCommitHash({
    drawId: input.drawId,
    poolHash: snapshotHash(input.poolEntryNumbers),
    entropy: input.entropy,
  });
  return {
    commitMatches: constantTimeEquals(commit, input.expectedCommitHash),
    recomputedPermutation: shuffleWith(
      [...input.poolEntryNumbers].sort((a, b) => a.localeCompare(b, "en", { numeric: true })),
      seededRng(input.entropy),
    ),
    snapshotMatchesHash: snapshotHash(input.poolEntryNumbers),
  };
}

export function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Cycle order for the draw animation.
 *
 * The animation is cosmetic only — winners are already chosen and stored — but
 * it should still feel organic, so slots are visited with a decreasing stride
 * instead of a plain modulo. Purely a presentation helper.
 */
export function animationCycleOrder(poolSize: number, length: number, seed: number): number[] {
  if (poolSize <= 0 || length <= 0) return [];
  const out: number[] = [];
  let index = Math.abs(seed) % poolSize;
  let stride = Math.max(1, Math.floor(poolSize / 2));
  for (let i = 0; i < length; i += 1) {
    out.push(index);
    index = (index + stride) % poolSize;
    // Gradually collapse the stride so the animation appears to slow down.
    if (i % 3 === 2 && stride > 1) stride = Math.max(1, Math.floor(stride / 2));
  }
  return out;
}
