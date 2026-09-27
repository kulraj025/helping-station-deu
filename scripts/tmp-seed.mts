import mod from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { encode } from "@auth/core/jwt";
import bcrypt from "bcryptjs";
const PrismaClient = (mod as any).PrismaClient;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const hash = await bcrypt.hash("testpass123", 10);
let admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
if (!admin) {
  admin = await prisma.user.create({ data: { email: "organiser@deu.ac.kr", name: "Test Organiser", role: "ADMIN", department: "Student Affairs", studentId: "A-000", passwordHash: hash } });
}
let ev = await prisma.event.findFirst();
if (!ev) {
  ev = await prisma.event.create({ data: { slug: "test-event", name: "Helping Station DEU 2026", description: "A test event.", locationName: "DEU Main Hall", startAt: new Date("2026-10-01T09:00:00Z"), endAt: new Date("2026-10-01T17:00:00Z"), registrationDeadline: new Date("2026-09-30T09:00:00Z"), status: "PUBLISHED", organizerName: "Helping Station DEU", createdById: admin.id } });
}
for (const [i, email] of ["a@deu.ac.kr", "b@deu.ac.kr"].entries()) {
  const found = await prisma.user.findUnique({ where: { email } });
  if (found) continue;
  const u = await prisma.user.create({ data: { email, name: `Participant ${i + 1}`, role: "STUDENT", department: "Nursing", studentId: `B-00${i + 1}`, passwordHash: hash } });
  await prisma.registration.create({ data: { eventId: ev.id, userId: u.id, entryNumber: `E-000${i + 1}`, consentPrivacy: true, consentContact: true, rulesAcceptedAt: new Date(), dataConsentAt: new Date() } });
}
const token = await encode({
  secret: process.env.AUTH_SECRET!,
  salt: "authjs.session-token",
  maxAge: 60 * 60 * 2,
  token: { sub: admin.id, userId: admin.id, role: "ADMIN", email: admin.email, name: admin.name, department: admin.department, studentId: admin.studentId },
});
console.log("COOKIE:" + token);
console.log("COUNTS:" + JSON.stringify({ users: await prisma.user.count(), regs: await prisma.registration.count() }));
await prisma.$disconnect();
