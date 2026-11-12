// PROTOTYPE — throwaway. Lives on branch prototype/notifications-ui only.
// Builds a fake Notification feed for the current user from real seed rows,
// shaped like the NotificationDraft decided in "Shape of the Notification seam
// and its disk store": recipient, kind, data, rendered title + body, one URL.
// Event list = the *candidates* from "Which events notify whom in v1?" (not final).
import { and, desc, eq, inArray, isNull, isNotNull, ne } from "drizzle-orm";
import { db } from "~/db";
import {
  comments,
  courseRatings,
  courses,
  enrollments,
  lessons,
  modules,
  purchases,
  refunds,
  teamMembers,
  TeamMemberRole,
  UserRole,
  users,
} from "~/db/schema";

export type PrototypeNotificationKind =
  | "refund-requested"
  | "refund-decided"
  | "refund-issued"
  | "seat-claimed"
  | "new-enrollment"
  | "new-comment"
  | "new-reply"
  | "new-rating"
  | "new-lessons";

export interface PrototypeNotification {
  id: string;
  kind: PrototypeNotificationKind;
  title: string;
  body: string;
  url: string;
  createdAt: string;
  // grouping key for the digest variant: kind + subject (usually a course)
  subject: string;
}

const HOUR = 60 * 60 * 1000;

function nameOf(userId: number) {
  return db.select({ name: users.name }).from(users).where(eq(users.id, userId)).get()?.name ?? "Someone";
}

// Spread fake timestamps over the last ~3 weeks, newest first, deterministic.
function stamp(list: Omit<PrototypeNotification, "createdAt" | "id">[]): PrototypeNotification[] {
  const now = Date.now();
  return list.map((n, i) => ({
    ...n,
    id: `p${i}`,
    createdAt: new Date(now - (i * i * 1.3 + i * 2 + 0.2) * HOUR).toISOString(),
  }));
}

function interleave<T>(...lists: T[][]): T[] {
  const out: T[] = [];
  const max = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < max; i++) for (const l of lists) if (l[i]) out.push(l[i]);
  return out;
}

function forInstructor(userId: number) {
  const own = db.select().from(courses).where(eq(courses.instructorId, userId)).all();
  if (own.length === 0) return [];
  const courseIds = own.map((c) => c.id);
  const bySlug = new Map(own.map((c) => [c.id, c]));

  const enrolls = db
    .select({ userId: enrollments.userId, courseId: enrollments.courseId })
    .from(enrollments)
    .where(inArray(enrollments.courseId, courseIds))
    .orderBy(desc(enrollments.enrolledAt))
    .limit(30)
    .all()
    .map((e) => {
      const c = bySlug.get(e.courseId)!;
      return {
        kind: "new-enrollment" as const,
        title: `New Enrollment in ${c.title}`,
        body: `${nameOf(e.userId)} enrolled.`,
        url: `/instructor/${c.id}/students`,
        subject: c.title,
      };
    });

  const qs = db
    .select({ id: comments.id, userId: comments.userId, body: comments.body, lessonId: lessons.id, lessonTitle: lessons.title, courseId: modules.courseId })
    .from(comments)
    .innerJoin(lessons, eq(comments.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(and(inArray(modules.courseId, courseIds), isNull(comments.parentId), ne(comments.userId, userId)))
    .orderBy(desc(comments.createdAt))
    .limit(8)
    .all()
    .map((q) => {
      const c = bySlug.get(q.courseId)!;
      return {
        kind: "new-comment" as const,
        title: `New Discussion Question on “${q.lessonTitle}”`,
        body: `${nameOf(q.userId)}: ${q.body.slice(0, 90)}${q.body.length > 90 ? "…" : ""}`,
        url: `/courses/${c.slug}/lessons/${q.lessonId}`,
        subject: c.title,
      };
    });

  const ratings = db
    .select()
    .from(courseRatings)
    .where(inArray(courseRatings.courseId, courseIds))
    .orderBy(desc(courseRatings.updatedAt))
    .limit(6)
    .all()
    .map((r) => {
      const c = bySlug.get(r.courseId)!;
      return {
        kind: "new-rating" as const,
        title: `New rating on ${c.title}`,
        body: `${nameOf(r.userId)} rated it ${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}.`,
        url: `/instructor/${c.id}`,
        subject: c.title,
      };
    });

  // Enrollments dominate (~40% in the count ticket); interleave 3:1 to mimic that.
  const e = enrolls;
  const mixed: any[] = [];
  let ei = 0;
  const others = interleave<any>(qs, ratings);
  for (const o of others) {
    mixed.push(...e.slice(ei, ei + 2), o);
    ei += 2;
  }
  mixed.push(...e.slice(ei));
  return mixed;
}

function forStudent(userId: number) {
  const enrolled = db
    .select({ id: courses.id, title: courses.title, slug: courses.slug })
    .from(enrollments)
    .innerJoin(courses, eq(enrollments.courseId, courses.id))
    .where(eq(enrollments.userId, userId))
    .all();

  const newLessons = enrolled.slice(0, 3).map((c) => ({
    kind: "new-lessons" as const,
    title: `New lessons in ${c.title}`,
    body: `2 lessons were added to a module you're taking.`,
    url: `/courses/${c.slug}`,
    subject: c.title,
  }));

  const myQuestions = db
    .select({ id: comments.id })
    .from(comments)
    .where(and(eq(comments.userId, userId), isNull(comments.parentId)))
    .all()
    .map((c) => c.id);
  const replies = myQuestions.length
    ? db
        .select({ userId: comments.userId, body: comments.body, lessonId: lessons.id, lessonTitle: lessons.title, slug: courses.slug, courseTitle: courses.title })
        .from(comments)
        .innerJoin(lessons, eq(comments.lessonId, lessons.id))
        .innerJoin(modules, eq(lessons.moduleId, modules.id))
        .innerJoin(courses, eq(modules.courseId, courses.id))
        .where(and(inArray(comments.parentId, myQuestions), ne(comments.userId, userId)))
        .limit(5)
        .all()
        .map((r) => ({
          kind: "new-reply" as const,
          title: `${nameOf(r.userId)} replied to your question`,
          body: `On “${r.lessonTitle}”: ${r.body.slice(0, 90)}${r.body.length > 90 ? "…" : ""}`,
          url: `/courses/${r.slug}/lessons/${r.lessonId}`,
          subject: r.courseTitle,
        }))
    : [];

  const myRefunds = db
    .select({ status: refunds.status, amount: refunds.amountRefunded, slug: courses.slug, title: courses.title })
    .from(refunds)
    .innerJoin(purchases, eq(refunds.purchaseId, purchases.id))
    .innerJoin(courses, eq(purchases.courseId, courses.id))
    .where(and(eq(purchases.userId, userId), isNotNull(refunds.resolvedAt)))
    .all()
    .flatMap((r) => {
      const approved = r.amount != null;
      const decided = {
        kind: "refund-decided" as const,
        title: `Your Refund Request was ${approved ? "approved" : "declined"}`,
        body: approved ? r.title : `${r.title} — “You have completed more than half the course.”`,
        url: `/courses/${r.slug}`,
        subject: r.title,
      };
      return approved
        ? [
            { kind: "refund-issued" as const, title: `Refund issued: $${((r.amount ?? 0) / 100).toFixed(2)}`, body: `For ${r.title}. It can take 5–10 days to reach your card.`, url: `/courses/${r.slug}`, subject: r.title },
            decided,
          ]
        : [decided];
    });

  // Fallback so a Student with no refunds still sees the kind.
  if (myRefunds.length === 0 && enrolled[0]) {
    myRefunds.push({
      kind: "refund-decided",
      title: "Your Refund Request was declined",
      body: `${enrolled[0].title} — “You've completed more than half the course.”`,
      url: `/courses/${enrolled[0].slug}`,
      subject: enrolled[0].title,
    });
  }
  return interleave<any>(replies, myRefunds, newLessons);
}

const FAKE_REASONS = [
  "The course wasn't what I expected from the description.",
  "Bought it twice by mistake.",
  "Too advanced for me right now.",
  "My company is paying for a Team Licence instead.",
];

function forAdmin() {
  // Seed has no Refund Requests, so fake them from real Purchases.
  return db
    .select({ id: purchases.id, userId: purchases.userId, title: courses.title })
    .from(purchases)
    .innerJoin(courses, eq(purchases.courseId, courses.id))
    .orderBy(desc(purchases.createdAt))
    .limit(6)
    .all()
    .map((r, i) => ({ ...r, reason: FAKE_REASONS[i % FAKE_REASONS.length] }))
    .map((r) => ({
      kind: "refund-requested" as const,
      title: `New Refund Request from ${nameOf(r.userId)}`,
      body: `${r.title} — “${r.reason.slice(0, 80)}${r.reason.length > 80 ? "…" : ""}”`,
      url: `/admin/refunds`,
      subject: "Refund Requests",
    }));
}

function forTeamAdmin(userId: number) {
  const m = db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.userId, userId), eq(teamMembers.role, TeamMemberRole.Admin)))
    .get();
  if (!m) return [];
  return db
    .select({ userId: teamMembers.userId })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, m.teamId), ne(teamMembers.userId, userId)))
    .limit(4)
    .all()
    .map((s) => ({
      kind: "seat-claimed" as const,
      title: `${nameOf(s.userId)} claimed a seat`,
      body: `On your Team Licence.`,
      url: `/team`,
      subject: "Team Licence",
    }));
}

export function prototypeNotificationsFor(
  userId: number | null,
  role: UserRole | null,
  feed: string | null
): PrototypeNotification[] {
  if (!userId || !role || feed === "empty") return [];
  const lists: any[][] = [];
  if (role === UserRole.Instructor) lists.push(forInstructor(userId));
  if (role === UserRole.Student) lists.push(forStudent(userId));
  if (role === UserRole.Admin) lists.push(forAdmin());
  lists.push(forTeamAdmin(userId));
  return stamp(interleave(...lists));
}
