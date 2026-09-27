import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Guard rails on the account-deletion actions.
 *
 * These are the only actions in the app that destroy data, and they are
 * reachable by any signed-in organiser, so the checks that stand between a
 * mis-click and an unrecoverable deletion are worth pinning down. Each test
 * below corresponds to a specific way the action could be wrong:
 *
 *  - deleting the account you are signed in with, locking yourself out mid-session
 *  - deleting the last organiser, after which nobody can administer the site at
 *    all and recovery needs a database edit
 *  - the "delete everyone" action firing on an unconfirmed or near-miss
 *    confirmation, which on a phone is one autocorrect away
 *  - organisers being swept up in a bulk participant delete
 *
 * Prisma and the auth guard are mocked rather than run against a database, so
 * these stay fast and deterministic. What is verified is *which* queries the
 * action issues and in what order — the decision logic — not Prisma's cascade
 * behaviour, which the schema's `onDelete` clauses already declare.
 */

/**
 * `server-only` throws on import outside a React Server Component graph, which
 * vitest deliberately is not. The marker has no runtime behaviour worth testing,
 * so it is stubbed to nothing and the real module graph loads normally.
 */
vi.mock("server-only", () => ({}));

/**
 * `revalidatePath` throws unless it is called inside a live Next.js request,
 * because it writes to the static-generation store that only exists there. The
 * calls are recorded rather than stubbed to nothing, so a test can still assert
 * that a mutation invalidated the pages it affects — which is a real way for
 * these actions to be wrong (a delete that leaves a stale list on screen).
 */
const revalidatePathMock = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

const prismaMock = {
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  registration: { count: vi.fn() },
  siteSettings: { findUnique: vi.fn(), upsert: vi.fn() },
  auditLog: { create: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const requireAdminMock = vi.fn();
vi.mock("@/lib/auth-helpers", () => ({ requireAdmin: requireAdminMock }));

const writeAuditMock = vi.fn();
vi.mock("@/server/services/audit", async () => {
  const actual = await vi.importActual<typeof import("@/server/services/audit")>(
    "@/server/services/audit",
  );
  return { ...actual, writeAudit: writeAuditMock };
});

const { deleteAllParticipantsAction, deleteUserAction } = await import(
  "@/server/actions/admin-controls"
);

/** Form body, as a checkbox-and-hidden-field form would send it. */
function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const ADMIN = { id: "admin-1", name: "Organiser", email: "o@deu.ac.kr", role: "ADMIN" };

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminMock.mockResolvedValue(ADMIN);
  prismaMock.registration.count.mockResolvedValue(0);
  prismaMock.auditLog.create.mockResolvedValue({});
});

describe("deleteUserAction", () => {
  it("refuses when no account was selected", async () => {
    const state = await deleteUserAction({ status: "idle" }, form({}));
    expect(state.status).toBe("error");
    expect(prismaMock.user.delete).not.toHaveBeenCalled();
  });

  it("refuses to delete the account doing the deleting", async () => {
    // Checked before any database read: the admin id comes from the session, so
    // a lookup would be wasted work as well as a wasted chance to get it wrong.
    const state = await deleteUserAction(
      { status: "idle" },
      form({ userId: ADMIN.id }),
    );
    expect(state.status).toBe("error");
    expect(state.message).toMatch(/cannot delete the account you are signed in with/i);
    expect(prismaMock.user.delete).not.toHaveBeenCalled();
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it("refuses when the account no longer exists", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const state = await deleteUserAction({ status: "idle" }, form({ userId: "ghost" }));
    expect(state.status).toBe("error");
    expect(prismaMock.user.delete).not.toHaveBeenCalled();
  });

  it("refuses to delete the last remaining organiser", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "admin-2",
      email: "second@deu.ac.kr",
      name: "Second Organiser",
      role: "ADMIN",
    });
    prismaMock.user.count.mockResolvedValue(0); // no other admins

    const state = await deleteUserAction({ status: "idle" }, form({ userId: "admin-2" }));

    expect(state.status).toBe("error");
    expect(state.message).toMatch(/only organiser account left/i);
    expect(prismaMock.user.delete).not.toHaveBeenCalled();
  });

  it("allows deleting an organiser when another one remains", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "admin-2",
      email: "second@deu.ac.kr",
      name: "Second Organiser",
      role: "ADMIN",
    });
    prismaMock.user.count.mockResolvedValue(1); // one other admin
    prismaMock.user.delete.mockResolvedValue({});

    const state = await deleteUserAction({ status: "idle" }, form({ userId: "admin-2" }));

    expect(state.status).toBe("success");
    expect(prismaMock.user.delete).toHaveBeenCalledWith({ where: { id: "admin-2" } });
  });

  it("deletes a participant and reports how many registrations went with them", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "stu-1",
      email: "s@deu.ac.kr",
      name: "Student One",
      role: "STUDENT",
    });
    prismaMock.registration.count.mockResolvedValue(3);
    prismaMock.user.delete.mockResolvedValue({});

    const state = await deleteUserAction({ status: "idle" }, form({ userId: "stu-1" }));

    expect(state.status).toBe("success");
    // The count is surfaced because the deletion is not just the account: the
    // registrations go too, and an organiser should not have to guess.
    expect(state.message).toContain("3 registrations");
    expect(writeAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "admin.user_deleted",
        targetId: "stu-1",
        metadata: expect.objectContaining({ registrationsRemoved: 3 }),
      }),
    );
  });

  it("uses the singular when exactly one registration is removed", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "stu-1",
      email: "s@deu.ac.kr",
      name: "Student One",
      role: "STUDENT",
    });
    prismaMock.registration.count.mockResolvedValue(1);
    prismaMock.user.delete.mockResolvedValue({});

    const state = await deleteUserAction({ status: "idle" }, form({ userId: "stu-1" }));
    expect(state.message).toContain("1 registration removed");
    expect(state.message).not.toContain("1 registrations");
  });

  it("revalidates the screens that show the account list", async () => {
    // Without this the delete succeeds but the organiser keeps looking at the
    // old list until they refresh, which reads as "the button did nothing".
    prismaMock.user.findUnique.mockResolvedValue({
      id: "stu-1",
      email: "s@deu.ac.kr",
      name: "Student One",
      role: "STUDENT",
    });
    prismaMock.user.delete.mockResolvedValue({});

    await deleteUserAction({ status: "idle" }, form({ userId: "stu-1" }));

    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/controls");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/participants");
  });
});

describe("deleteAllParticipantsAction", () => {
  it("refuses when the confirmation is missing", async () => {
    const state = await deleteAllParticipantsAction({ status: "idle" }, form({}));
    expect(state.status).toBe("error");
    expect(state.message).toMatch(/nothing was removed/i);
    expect(prismaMock.user.deleteMany).not.toHaveBeenCalled();
  });

  it.each(["delete", "Delete ", "DELETED", " delete", "remove", ""])(
    "refuses the near-miss confirmation %j",
    async (typed) => {
      const state = await deleteAllParticipantsAction(
        { status: "idle" },
        form({ confirm: typed }),
      );
      expect(state.status).toBe("error");
      expect(prismaMock.user.deleteMany).not.toHaveBeenCalled();
    },
  );

  it("never includes organisers in the deletion", async () => {
    // The single most important assertion in this file: organisers must survive,
    // or the site becomes unadministrable.
    prismaMock.user.findMany.mockResolvedValue([{ id: "stu-1" }, { id: "stu-2" }]);
    prismaMock.registration.count.mockResolvedValue(5);
    prismaMock.user.deleteMany.mockResolvedValue({ count: 2 });

    const state = await deleteAllParticipantsAction(
      { status: "idle" },
      form({ confirm: "DELETE" }),
    );

    expect(state.status).toBe("success");
    expect(prismaMock.user.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["stu-1", "stu-2"] } },
    });
    expect(state.message).toMatch(/organiser accounts were kept/i);
  });

  it("asks the database for non-admins only, rather than filtering in memory", async () => {
    prismaMock.user.findMany.mockResolvedValue([]);
    await deleteAllParticipantsAction({ status: "idle" }, form({ confirm: "DELETE" }));
    expect(prismaMock.user.findMany).toHaveBeenCalledWith({
      where: { role: { not: "ADMIN" } },
      select: { id: true },
    });
  });

  it("does nothing at all when there is nobody to delete", async () => {
    prismaMock.user.findMany.mockResolvedValue([]);
    const state = await deleteAllParticipantsAction(
      { status: "idle" },
      form({ confirm: "DELETE" }),
    );
    expect(state.status).toBe("success");
    expect(state.message).toMatch(/no participant accounts/i);
    expect(prismaMock.user.deleteMany).not.toHaveBeenCalled();
    expect(writeAuditMock).not.toHaveBeenCalled();
  });

  it("revalidates the whole site, because registrations feed the public pages", async () => {
    prismaMock.user.findMany.mockResolvedValue([{ id: "stu-1" }]);
    prismaMock.user.deleteMany.mockResolvedValue({ count: 1 });

    await deleteAllParticipantsAction({ status: "idle" }, form({ confirm: "DELETE" }));

    // A layout-wide revalidation, not just the admin screens: the public
    // participant count and winners page both read the rows that were removed.
    expect(revalidatePathMock).toHaveBeenCalledWith("/", "layout");
  });
});
