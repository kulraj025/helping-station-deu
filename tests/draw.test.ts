import { describe, expect, it } from "vitest";
import {
  animationCycleOrder,
  buildPrizeSlots,
  constantTimeEquals,
  createSelectionEntropy,
  cryptoRng,
  CRYPTO_ENTROPY_BYTES,
  seededRng,
  selectWinners,
  selectionCommitHash,
  shuffleWith,
  snapshotHash,
  verifySelection,
  type PoolCandidate,
} from "@/lib/draw";

function pool(size: number): PoolCandidate[] {
  return Array.from({ length: size }, (_, index) => ({
    registrationId: `reg-${index + 1}`,
    entryNumber: `HS-${String(index + 1).padStart(4, "0")}`,
  }));
}

const entropy = "a".repeat(CRYPTO_ENTROPY_BYTES * 2);

describe("cryptoRng", () => {
  it("stays inside the requested range", () => {
    const rng = cryptoRng();
    for (let i = 0; i < 5_000; i += 1) {
      const value = rng(7);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(7);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it("rejects a non-positive or fractional range", () => {
    const rng = cryptoRng();
    expect(() => rng(0)).toThrow(RangeError);
    expect(() => rng(-3)).toThrow(RangeError);
    expect(() => rng(2.5)).toThrow(RangeError);
  });

  it("is roughly uniform, not skewed by modulo bias", () => {
    const rng = cryptoRng();
    const buckets = new Array(6).fill(0);
    const rounds = 60_000;
    for (let i = 0; i < rounds; i += 1) buckets[rng(6)] += 1;

    const expected = rounds / 6;
    // 5% tolerance: far tighter than the ~3% a biased modulo would produce at
    // 6 buckets with a single byte of entropy, and still not flaky.
    for (const count of buckets) {
      expect(Math.abs(count - expected) / expected).toBeLessThan(0.05);
    }
  });
});

describe("seededRng", () => {
  it("is deterministic for the same entropy", () => {
    const a = seededRng(entropy);
    const b = seededRng(entropy);
    const first = Array.from({ length: 100 }, () => a(1_000));
    const second = Array.from({ length: 100 }, () => b(1_000));
    expect(first).toEqual(second);
  });

  it("produces a different stream for different entropy", () => {
    const a = seededRng(entropy);
    const b = seededRng("b".repeat(CRYPTO_ENTROPY_BYTES * 2));
    const first = Array.from({ length: 50 }, () => a(1_000));
    const second = Array.from({ length: 50 }, () => b(1_000));
    expect(first).not.toEqual(second);
  });

  it("refuses weak entropy", () => {
    expect(() => seededRng("0011223344")).toThrow(RangeError);
  });

  it("stays within range and is approximately uniform", () => {
    const rng = seededRng(entropy);
    const buckets = new Array(5).fill(0);
    for (let i = 0; i < 50_000; i += 1) buckets[rng(5)] += 1;
    const expected = 10_000;
    for (const count of buckets) {
      expect(Math.abs(count - expected) / expected).toBeLessThan(0.05);
    }
  });

  it("handles a range wider than a single byte", () => {
    // Regression: sampling a range above 256 from one byte gives a rejection
    // limit of zero, so the loop below would never terminate. A real event with
    // more than 256 eligible participants would have hung the draw here.
    const rng = seededRng(entropy);
    const values = Array.from({ length: 200 }, () => rng(1_000));
    for (const value of values) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1_000);
      expect(Number.isInteger(value)).toBe(true);
    }
    expect(new Set(values).size).toBeGreaterThan(100);
  });

  it("stays uniform for a range wider than a single byte", () => {
    const rng = seededRng(entropy);
    const buckets = new Array(4).fill(0);
    for (let i = 0; i < 20_000; i += 1) buckets[rng(1_000) % 4] += 1;
    const expected = 5_000;
    for (const count of buckets) {
      expect(Math.abs(count - expected) / expected).toBeLessThan(0.1);
    }
  });

  it("shuffles a pool larger than 256 candidates", () => {
    const large = Array.from({ length: 1_000 }, (_, index) => index);
    const shuffled = shuffleWith(large, seededRng(entropy));
    expect(shuffled).toHaveLength(1_000);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(large);
    expect(shuffled).not.toEqual(large);
  });

  it("refuses a range beyond what a double can hold exactly", () => {
    expect(() => seededRng(entropy)(2 ** 48)).toThrow(RangeError);
  });
});

describe("shuffleWith", () => {
  it("is a permutation: nothing added, nothing lost", () => {
    const items = Array.from({ length: 500 }, (_, index) => index);
    const shuffled = shuffleWith(items, seededRng(entropy));
    expect(shuffled).toHaveLength(items.length);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(items);
  });

  it("does not mutate its input", () => {
    const items = [1, 2, 3, 4, 5];
    shuffleWith(items, seededRng(entropy));
    expect(items).toEqual([1, 2, 3, 4, 5]);
  });

  it("handles empty and single-element lists", () => {
    expect(shuffleWith([], seededRng(entropy))).toEqual([]);
    expect(shuffleWith(["only"], seededRng(entropy))).toEqual(["only"]);
  });

  it("actually reorders a large list", () => {
    const items = Array.from({ length: 200 }, (_, index) => index);
    const shuffled = shuffleWith(items, seededRng(entropy));
    // The chance of an identical permutation is effectively zero.
    expect(shuffled).not.toEqual(items);
  });
});

describe("buildPrizeSlots", () => {
  it("expands quantity into individual slots in configured order", () => {
    const slots = buildPrizeSlots([
      { id: "p2", name: "Second", order: 2, quantity: 2 },
      { id: "p1", name: "First", order: 1, quantity: 3 },
    ]);
    expect(slots).toHaveLength(5);
    expect(slots.map((slot) => slot.prizeId)).toEqual(["p1", "p1", "p1", "p2", "p2"]);
    expect(slots.map((slot) => slot.slotIndex)).toEqual([0, 1, 2, 0, 1]);
    expect(slots[0]?.order).toBe(1);
    expect(slots[3]?.order).toBe(2);
  });

  it("clamps a nonsensical quantity to no slots rather than crashing", () => {
    expect(buildPrizeSlots([{ id: "p", name: "P", order: 1, quantity: -4 }])).toEqual([]);
    expect(buildPrizeSlots([{ id: "p", name: "P", order: 1, quantity: 0 }])).toEqual([]);
  });
});

describe("selectWinners", () => {
  const prizes = [{ id: "gold", name: "Gold", order: 1, quantity: 1 }];
  const slots = buildPrizeSlots(prizes);

  it("is fully reproducible from the same entropy", () => {
    const candidates = pool(30);
    const first = selectWinners({ pool: candidates, slots, entropy });
    const second = selectWinners({ pool: candidates, slots, entropy });

    expect(first.permutation).toEqual(second.permutation);
    expect(first.assignments).toEqual(second.assignments);
  });

  it("does not depend on the order the pool is supplied in", () => {
    const candidates = pool(40);
    const shuffled = [...candidates].reverse();

    const a = selectWinners({ pool: candidates, slots, entropy });
    const b = selectWinners({ pool: shuffled, slots, entropy });
    expect(a.permutation).toEqual(b.permutation);
  });

  it("awards exactly one winner per slot, never a duplicate", () => {
    const candidates = pool(12);
    const manySlots = buildPrizeSlots([
      { id: "a", name: "A", order: 1, quantity: 5 },
      { id: "b", name: "B", order: 2, quantity: 5 },
    ]);

    const result = selectWinners({ pool: candidates, slots: manySlots, entropy });
    expect(result.assignments).toHaveLength(10);

    const winners = result.assignments.map((a) => a.registrationId);
    expect(new Set(winners).size).toBe(winners.length);
  });

  it("fills prizes in configured order", () => {
    const ordered = buildPrizeSlots([
      { id: "gold", name: "Gold", order: 1, quantity: 1 },
      { id: "silver", name: "Silver", order: 2, quantity: 1 },
    ]);
    const result = selectWinners({ pool: pool(20), slots: ordered, entropy });
    expect(result.assignments.map((a) => a.prizeId)).toEqual(["gold", "silver"]);
  });

  it("skips blocked candidates rather than awarding them", () => {
    const candidates = pool(6);
    const first = selectWinners({ pool: candidates, slots, entropy });
    const blockedId = first.assignments[0]?.registrationId as string;

    const result = selectWinners({
      pool: candidates,
      slots: buildPrizeSlots([{ id: "a", name: "A", order: 1, quantity: 2 }]),
      entropy,
      isBlocked: (candidate) => candidate.registrationId === blockedId,
    });

    expect(result.assignments).toHaveLength(2);
    expect(result.assignments.map((a) => a.registrationId)).not.toContain(blockedId);
  });

  it("reports a shortfall instead of inventing a winner", () => {
    const result = selectWinners({ pool: pool(2), slots: buildPrizeSlots([{ id: "a", name: "A", order: 1, quantity: 5 }]), entropy });
    expect(result.assignments).toHaveLength(2);
    expect(result.notSelected).toHaveLength(0);
  });

  it("returns no winners for an empty pool", () => {
    const result = selectWinners({ pool: [], slots, entropy });
    expect(result.assignments).toEqual([]);
    expect(result.permutation).toEqual([]);
  });

  it("gives every candidate a fair chance across many runs", () => {
    // 3 candidates, 1 slot, 900 runs: each should win roughly a third of the
    // time. A biased shuffle or a modulo artefact would show up here.
    const candidates = pool(3);
    const tally = new Map<string, number>(candidates.map((c) => [c.registrationId, 0]));

    for (let i = 0; i < 900; i += 1) {
      const result = selectWinners({ pool: candidates, slots, entropy: createSelectionEntropy() });
      const winner = result.assignments[0]?.registrationId as string;
      tally.set(winner, (tally.get(winner) ?? 0) + 1);
    }

    for (const count of tally.values()) {
      expect(count).toBeGreaterThan(200);
      expect(count).toBeLessThan(400);
    }
  });

  it("handles a pool larger than 256 candidates", () => {
    // The realistic shape of a popular event: more eligible volunteers than
    // prize slots, with a range wider than a single RNG byte.
    const candidates = pool(400);
    const result = selectWinners({
      pool: candidates,
      slots: buildPrizeSlots([
        { id: "gold", name: "Gold", order: 1, quantity: 3 },
        { id: "silver", name: "Silver", order: 2, quantity: 7 },
      ]),
      entropy,
    });

    expect(result.assignments).toHaveLength(10);
    expect(result.permutation).toHaveLength(400);
    expect(new Set(result.assignments.map((a) => a.registrationId)).size).toBe(10);
    expect(result.notSelected).toHaveLength(390);
  });
});

describe("snapshotHash", () => {
  it("is stable across input ordering", () => {
    const numbers = ["HS-0003", "HS-0001", "HS-0002"];
    expect(snapshotHash(numbers)).toBe(snapshotHash([...numbers].reverse()));
  });

  it("changes when the pool changes", () => {
    expect(snapshotHash(["HS-0001", "HS-0002"])).not.toBe(snapshotHash(["HS-0001", "HS-0003"]));
  });

  it("is a prefixed SHA-256", () => {
    expect(snapshotHash(["HS-0001"])).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("orders numerically, not lexically", () => {
    // "HS-0010" must sort after "HS-0009", which a plain string sort gets wrong.
    expect(snapshotHash(["HS-0010", "HS-0009"])).toBe(snapshotHash(["HS-0009", "HS-0010"]));
  });
});

describe("selectionCommitHash and verifySelection", () => {
  const drawId = "draw_1";
  const candidates = pool(25);
  const entryNumbers = candidates.map((c) => c.entryNumber);
  const poolHash = snapshotHash(entryNumbers);
  const commit = selectionCommitHash({ drawId, poolHash, entropy });
  const slots = buildPrizeSlots([{ id: "gold", name: "Gold", order: 1, quantity: 1 }]);

  it("recomputes the permutation from published data", () => {
    const verified = verifySelection({
      drawId,
      poolEntryNumbers: entryNumbers,
      entropy,
      expectedCommitHash: commit,
    });
    expect(verified.commitMatches).toBe(true);
    expect(verified.snapshotMatchesHash).toBe(poolHash);

    const expected = selectWinners({ pool: candidates, slots, entropy });
    expect(verified.recomputedPermutation).toEqual(expected.permutation);
  });

  it("fails when the entropy has been altered", () => {
    const tampered = "f".repeat(CRYPTO_ENTROPY_BYTES * 2);
    const verified = verifySelection({
      drawId,
      poolEntryNumbers: entryNumbers,
      entropy: tampered,
      expectedCommitHash: commit,
    });
    expect(verified.commitMatches).toBe(false);
  });

  it("fails when the pool has been altered", () => {
    const verified = verifySelection({
      drawId,
      poolEntryNumbers: [...entryNumbers, "HS-9999"],
      entropy,
      expectedCommitHash: commit,
    });
    expect(verified.commitMatches).toBe(false);
  });

  it("fails when the draw id has been altered", () => {
    const verified = verifySelection({
      drawId: "draw_2",
      poolEntryNumbers: entryNumbers,
      entropy,
      expectedCommitHash: commit,
    });
    expect(verified.commitMatches).toBe(false);
  });
});

describe("constantTimeEquals", () => {
  it("compares equal and unequal strings correctly", () => {
    expect(constantTimeEquals("abc", "abc")).toBe(true);
    expect(constantTimeEquals("abc", "abd")).toBe(false);
  });

  it("does not throw on a length mismatch", () => {
    expect(constantTimeEquals("abc", "abcd")).toBe(false);
  });
});

describe("animationCycleOrder", () => {
  it("returns the requested number of indices inside the pool", () => {
    const order = animationCycleOrder(37, 60, 5);
    expect(order).toHaveLength(60);
    for (const index of order) {
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(37);
    }
  });

  it("is empty for degenerate arguments", () => {
    expect(animationCycleOrder(0, 10, 1)).toEqual([]);
    expect(animationCycleOrder(10, 0, 1)).toEqual([]);
  });
});
