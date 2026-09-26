/**
 * Database seed.
 *
 * Creates one organiser account, one student account, a live demo event and a
 * completed past event (with a real, verifiable draw result) so every screen of
 * the app has something to show.
 *
 *   npm run db:seed
 *
 * Demo participants are entirely fictional (HS-DEMO-###) and flagged with
 * `isDemo`, so they can never be confused with real students.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { DEPARTMENTS, VOLUNTEER_ROLES } from "../src/lib/constants";
import { maskName } from "../src/lib/privacy";
import {
  createSelectionEntropy,
  selectionCommitHash,
  selectWinners,
  snapshotHash,
} from "../src/lib/draw";

const adapter = new PrismaPg({
  connectionString:
    process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5433/helpingstation",
  max: Number.parseInt(process.env.DB_POOL_MAX ?? "10", 10) || 10,
});
const prisma = new PrismaClient({ adapter });

const DEMO_MODE = (process.env.DEMO_MODE ?? "true").toLowerCase() === "true";
const ADMIN_EMAIL = (process.env.SEED_ADMIN_EMAIL ?? "admin@helpingstation.deu").toLowerCase();
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe!2024";
const STUDENT_EMAIL = (process.env.SEED_STUDENT_EMAIL ?? "student@deu.ac.kr").toLowerCase();
const STUDENT_PASSWORD = process.env.SEED_STUDENT_PASSWORD ?? "ChangeMe!2024";

const HOURS = 3_600_000;
const DAYS = 24 * HOURS;

const FIRST_NAMES = [
  "Minseok", "Jiwoo", "Hyerin", "Seojun", "Hayoung", "Jiho", "Suyeon", "Doyun", "Yeon", "Taemin",
  "Sooah", "Junseo", "Hana", "Doyun", "Rina", "Kai", "Nara", "Sion", "Ayu", "Minjae",
  "Chae-won", "Eun", "Geon", "Ha-eun", "Joon", "Sara", "Yerin", "Louis", "Chaewon", "Seon",
  "Dayoon", "Yeonha", "Hwiyoung", "Jiseo", "Min", "Areum", "Sungmin", "Haneul", "Jisoo", "Won",
];
const LAST_NAMES = ["Kim", "Lee", "Park", "Choi", "Jung", "Kang", "Cho", "Yoon", "Jang", "Lim"];

const settings = {
  requireParticipationForEligibility: true,
  allowMultipleWinsPerParticipant: false,
  winnerDisplayMode: "MASKED",
  publicWinnersVisible: true,
  publicDrawScreenVisible: true,
  showParticipantCount: true,
  claimWindowDays: 14,
  requireDrawConsent: true,
  requireEmergencyContact: false,
  prizeClaimNote:
    "Bring your participation number and your student ID to the organiser desk. Prizes are collected in person during the closing session.",
  winnerContactMethod:
    "The organiser contacts each winner using the e-mail address and phone number collected at registration.",
  complianceNote:
    "This activity is a free appreciation draw for event participants. It is not gambling and no money is ever paid to enter. The organiser confirms that any prize or paid-entry mechanism complies with applicable university and local regulations before launch.",
};

function person(index: number) {
  const first = FIRST_NAMES[index % FIRST_NAMES.length] as string;
  const last = LAST_NAMES[Math.floor(index / FIRST_NAMES.length) % LAST_NAMES.length] as string;
  const name = `${first} ${last}`;
  return {
    name,
    email: `demo${String(index + 1).padStart(3, "0")}@demo.deu.ac.kr`,
    studentId: `2023${String(1000 + index)}`,
    department: DEPARTMENTS[index % DEPARTMENTS.length] as string,
    phone: `010-2000-${String(1000 + index).slice(-4)}`,
  };
}

async function main() {
  console.log("🌱 Seeding Helping Station DEU…\n");

  // --- accounts ------------------------------------------------------------
  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const studentHash = await bcrypt.hash(STUDENT_PASSWORD, 10);

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { role: "ADMIN", passwordHash: adminHash },
    create: {
      email: ADMIN_EMAIL,
      name: "Programme Coordinator",
      studentId: "ADMIN-001",
      department: "Student Affairs Office",
      phone: "010-0000-0000",
      role: "ADMIN",
      passwordHash: adminHash,
    },
  });
  console.log(`  ✓ Organiser account: ${ADMIN_EMAIL}`);

  const demoStudent = await prisma.user.upsert({
    where: { email: STUDENT_EMAIL },
    update: { passwordHash: studentHash },
    create: {
      email: STUDENT_EMAIL,
      name: "Demo Student",
      studentId: "20240001",
      department: "Software Engineering",
      phone: "010-1111-2222",
      role: "STUDENT",
      passwordHash: studentHash,
      isDemo: DEMO_MODE,
    },
  });
  console.log(`  ✓ Student account:    ${STUDENT_EMAIL}`);

  // --- live demo event -----------------------------------------------------
  const slug = "helping-station-deu-vol-1";
  const liveEvent = await prisma.event.upsert({
    where: { slug },
    update: {},
    create: {
      slug,
      name: "Helping Station DEU",
      tagline: "Social & Environmental Awareness & Volunteer Action Program",
      description:
        "A full-day student programme combining awareness sessions, creative teamwork, and hands-on volunteer action. Teams learn about local environmental and social issues, design their own awareness material, present it, and then put their ideas into practice on campus and in the community.",
      locationName: "Dong-Eui University",
      locationAddress: "Wonsan-ro, Buk-gu, Daegu, South Korea",
      startAt: new Date(Date.now() + 12 * DAYS),
      endAt: new Date(Date.now() + 12 * DAYS + 7 * HOURS),
      registrationDeadline: new Date(Date.now() + 7 * DAYS),
      status: "PUBLISHED",
      capacity: 300,
      organizerName: "Helping Station DEU — Student Volunteer Team",
      organizerDepartment: "Student Affairs Office",
      organizerContact: "helpingstation@deu.ac.kr",
      settings,
      isDemo: DEMO_MODE,
      createdById: admin.id,
    },
  });

  const livePrizes = [
    { name: "Grand Prize", description: "Eco-friendly campus hamper", quantity: 1, order: 1 },
    { name: "Second Prize", description: "Reusable bottle + notebook set", quantity: 1, order: 2 },
    { name: "Third Prize", description: "Plant a seed kit", quantity: 1, order: 3 },
    { name: "Participation Prize", description: "Thanks for taking part", quantity: 5, order: 4 },
  ];
  for (const prize of livePrizes) {
    await prisma.prize.upsert({
      where: { eventId_order: { eventId: liveEvent.id, order: prize.order } },
      update: {},
      create: { ...prize, eventId: liveEvent.id },
    });
  }
  console.log(`  ✓ Live event:          ${liveEvent.name} (${liveEvent.status})`);

  // --- participants for the live event -------------------------------------
  const existingLive = await prisma.registration.count({ where: { eventId: liveEvent.id } });
  if (existingLive === 0) {
    const count = 27;
    for (let index = 0; index < count; index += 1) {
      const data = person(index);
      const participated = index < 22;
      const eligible = participated && index % 9 !== 0;
      const demoUser =
        index === 0
          ? demoStudent
          : await prisma.user.upsert({
              where: { email: data.email },
              update: {},
              create: { ...data, role: "STUDENT", isDemo: true, passwordHash: null },
            });
      await prisma.registration.create({
        data: {
          eventId: liveEvent.id,
          userId: demoUser.id,
          entryNumber: `HS-DEMO-${String(index + 1).padStart(3, "0")}`,
          registrationStatus: "CONFIRMED",
          participationStatus: participated ? "PARTICIPATED" : index % 3 === 0 ? "NO_SHOW" : "REGISTERED",
          drawEligibility: eligible ? "ELIGIBLE" : participated ? "INELIGIBLE" : "PENDING",
          eligibilityReason: eligible ? null : participated ? "Joined after the main clean-up activity" : null,
          volunteerRole: VOLUNTEER_ROLES[index % VOLUNTEER_ROLES.length] as string,
          verifiedAt: participated ? new Date(Date.now() - HOURS) : null,
          verifiedById: participated ? admin.id : null,
          rulesAcceptedAt: new Date(Date.now() - 3 * DAYS),
          dataConsentAt: new Date(Date.now() - 3 * DAYS),
          drawConsentAt: new Date(Date.now() - 3 * DAYS),
          contactConsentAt: new Date(Date.now() - 3 * DAYS),
          publicDisplayConsent: index % 2 === 0,
          isDemo: true,
        },
      });
    }
    console.log(`  ✓ Registrations:      ${count} demo participants`);
  }

  // --- completed past event with a real draw result -----------------------
  const pastSlug = "helping-station-deu-vol-0";
  const pastEvent = await prisma.event.upsert({
    where: { slug: pastSlug },
    update: {},
    create: {
      slug: pastSlug,
      name: "Helping Station DEU — Campus Green Action Day",
      tagline: "Social & Environmental Awareness & Volunteer Action Program",
      description:
        "Our previous edition: an awareness session, poster teams, group showcases and a campus-wide clean-up with waste separation stations.",
      locationName: "Dong-Eui University",
      locationAddress: "Wonsan-ro, Buk-gu, Daegu, South Korea",
      startAt: new Date(Date.now() - 40 * DAYS),
      endAt: new Date(Date.now() - 40 * DAYS + 6 * HOURS),
      registrationDeadline: new Date(Date.now() - 46 * DAYS),
      status: "COMPLETED",
      capacity: 200,
      organizerName: "Helping Station DEU — Student Volunteer Team",
      organizerDepartment: "Student Affairs Office",
      organizerContact: "helpingstation@deu.ac.kr",
      settings,
      isDemo: DEMO_MODE,
      createdById: admin.id,
    },
  });

  const pastPrizes = [
    { name: "Grand Prize", description: "Eco-friendly campus hamper", quantity: 1, order: 1 },
    { name: "Second Prize", description: "Reusable bottle + notebook set", quantity: 1, order: 2 },
    { name: "Participation Prize", description: "Thanks for taking part", quantity: 3, order: 3 },
  ];
  const pastPrizeRows: Array<{ id: string; order: number }> = [];
  for (const prize of pastPrizes) {
    pastPrizeRows.push(
      await prisma.prize.upsert({
        where: { eventId_order: { eventId: pastEvent.id, order: prize.order } },
        update: {},
        create: { ...prize, eventId: pastEvent.id },
      }),
    );
  }

  const pastDrawCount = await prisma.draw.count({ where: { eventId: pastEvent.id, official: true } });
  if (pastDrawCount === 0) {
    // Clean any partial leftovers so re-running the seed stays idempotent.
    await prisma.registration.deleteMany({ where: { eventId: pastEvent.id } });

    const participantCount = 31;
    const registrations = [];
    const identities = new Map<string, { name: string; department: string }>();
    for (let index = 0; index < participantCount; index += 1) {
      const data = person(index + 100);
      const user = await prisma.user.upsert({
        where: { email: data.email },
        update: {},
        create: { ...data, role: "STUDENT", isDemo: true, passwordHash: null },
      });
      const registration = await prisma.registration.create({
        data: {
          eventId: pastEvent.id,
          userId: user.id,
          entryNumber: `HS-DEMO-${String(index + 1).padStart(3, "0")}`,
          registrationStatus: "CONFIRMED",
          participationStatus: "PARTICIPATED",
          drawEligibility: "ELIGIBLE",
          volunteerRole: VOLUNTEER_ROLES[index % VOLUNTEER_ROLES.length] as string,
          verifiedAt: new Date(Date.now() - 40 * DAYS),
          verifiedById: admin.id,
          rulesAcceptedAt: new Date(Date.now() - 46 * DAYS),
          dataConsentAt: new Date(Date.now() - 46 * DAYS),
          drawConsentAt: new Date(Date.now() - 46 * DAYS),
          contactConsentAt: new Date(Date.now() - 46 * DAYS),
          publicDisplayConsent: true,
          isDemo: true,
        },
      });
      identities.set(registration.id, { name: user.name, department: user.department });
      registrations.push(registration);
    }

    // --- run a genuine, auditable draw ------------------------------------
    const pool = registrations.map((r) => ({ registrationId: r.id, entryNumber: r.entryNumber }));
    const poolHash = snapshotHash(pool.map((p) => p.entryNumber));
    const entropy = createSelectionEntropy();

    const draw = await prisma.draw.create({
      data: {
        eventId: pastEvent.id,
        official: true,
        status: "LOCKED",
        initiatedById: admin.id,
        startedAt: new Date(Date.now() - 40 * DAYS + 5 * HOURS),
        poolLockedAt: new Date(Date.now() - 40 * DAYS + 5 * HOURS),
        eligibleParticipantCount: pool.length,
        poolSnapshotHash: poolHash,
        totalPrizeSlots: pastPrizes.reduce((sum, p) => sum + p.quantity, 0),
      },
    });

    await prisma.drawPoolEntry.createMany({
      data: pool.map((candidate, index) => ({
        drawId: draw.id,
        registrationId: candidate.registrationId,
        entryNumber: candidate.entryNumber,
        sequence: index + 1,
      })),
    });

    // Commitment is created from the real draw id so verification passes later.
    const commit = selectionCommitHash({ drawId: draw.id, poolHash, entropy });
    const result = selectWinners({
      pool,
      entropy,
      slots: pastPrizes.flatMap((prize) =>
        Array.from({ length: prize.quantity }, (_, slotIndex) => ({
          prizeId: (pastPrizeRows.find((p) => p.order === prize.order) as { id: string }).id,
          prizeName: prize.name,
          order: prize.order,
          slotIndex,
        })),
      ),
    });

    await prisma.winner.createMany({
      data: result.assignments.map((assignment) => {
        const identity = identities.get(assignment.registrationId);
        return {
          drawId: draw.id,
          eventId: pastEvent.id,
          prizeId: assignment.prizeId,
          registrationId: assignment.registrationId,
          entryNumber: assignment.entryNumber,
          displayName: maskName(identity?.name ?? "Participant"),
          department: identity?.department ?? null,
          selectedAt: new Date(Date.now() - 40 * DAYS + 5.5 * HOURS),
          claimStatus: "CLAIMED",
          notifiedAt: new Date(Date.now() - 40 * DAYS + 6 * HOURS),
          claimedAt: new Date(Date.now() - 39 * DAYS),
          isDemo: true,
        };
      }),
    });

    await prisma.drawPoolEntry.updateMany({
      where: { drawId: draw.id, registrationId: { in: result.assignments.map((a) => a.registrationId) } },
      data: { isWinner: true },
    });

    await prisma.draw.update({
      where: { id: draw.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(Date.now() - 40 * DAYS + 5.5 * HOURS),
        selectionDigest: commit,
        selectionEntropy: entropy,
      },
    });

    await prisma.auditLog.createMany({
      data: [
        {
          action: "draw.pool_locked",
          eventId: pastEvent.id,
          drawId: draw.id,
          adminId: admin.id,
          targetType: "Draw",
          targetId: draw.id,
          metadata: { eligible: pool.length, poolHash, prizeCount: pastPrizes.length },
          createdAt: new Date(Date.now() - 40 * DAYS + 5 * HOURS),
        },
        {
          action: "draw.completed",
          eventId: pastEvent.id,
          drawId: draw.id,
          adminId: admin.id,
          targetType: "Draw",
          targetId: draw.id,
          metadata: {
            eligible: pool.length,
            slots: pastPrizes.reduce((sum, p) => sum + p.quantity, 0),
            winners: result.assignments.length,
            poolHash,
            commitHash: commit,
            entryNumbers: result.assignments.map((a) => a.entryNumber),
          },
          createdAt: new Date(Date.now() - 40 * DAYS + 5.5 * HOURS),
        },
      ],
    });

    console.log(`  ✓ Past event:         ${pastEvent.name} (COMPLETED)`);
    console.log(`  ✓ Draw result:        ${result.assignments.length} winners recorded`);
  }

  console.log("\n✅ Seed complete.\n");
  console.log("  Organiser login :", ADMIN_EMAIL, "/", ADMIN_PASSWORD);
  console.log("  Student login   :", STUDENT_EMAIL, "/", STUDENT_PASSWORD);
  console.log("");
}

main()
  .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
