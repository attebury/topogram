import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const demoUserId = process.env.TOPOGRAM_DEMO_USER_ID || "41111111-1111-4111-8111-111111111111";
const forbiddenUserId = process.env.TOPOGRAM_FORBIDDEN_USER_ID || "41111111-1111-4111-8111-111111111112";
const demoBoardId = process.env.TOPOGRAM_DEMO_CONTAINER_ID || "42222222-2222-4222-8222-222222222222";
const demoIssueId = process.env.TOPOGRAM_DEMO_PRIMARY_ID || "43333333-3333-4333-8333-333333333333";
const forbiddenIssueId = process.env.TOPOGRAM_FORBIDDEN_PRIMARY_ID || "43333333-3333-4333-8333-333333333336";

async function main() {
  const now = new Date();

  await prisma.user.upsert({
    where: { email: "issues.demo@topogram.local" },
    update: {
      display_name: "Issues Demo User",
      is_active: true
    },
    create: {
      id: demoUserId,
      email: "issues.demo@topogram.local",
      display_name: "Issues Demo User",
      is_active: true,
      created_at: now
    }
  });

  await prisma.user.upsert({
    where: { email: "issues.restricted@topogram.local" },
    update: {
      display_name: "Issues Restricted User",
      is_active: true
    },
    create: {
      id: forbiddenUserId,
      email: "issues.restricted@topogram.local",
      display_name: "Issues Restricted User",
      is_active: true,
      created_at: now
    }
  });

  await prisma.board.upsert({
    where: { name: "Platform Reliability" },
    update: {
      status: "active",
      description: "Seeded demo board for the generated Issues runtime"
    },
    create: {
      id: demoBoardId,
      name: "Platform Reliability",
      description: "Seeded demo board for the generated Issues runtime",
      status: "active",
      created_at: now
    }
  });

  const issues = [
  {
    "id": "43333333-3333-4333-8333-333333333333",
    "title": "Seeded Demo Issue",
    "description": "This issue was created by the generated demo seed script.",
    "status": "open",
    "closed_at": null,
    "priority": "high"
  },
  {
    "id": "43333333-3333-4333-8333-333333333334",
    "title": "Improve issue filtering",
    "description": "Verify board and assignee filters in the generated web app.",
    "status": "in_progress",
    "closed_at": null,
    "priority": "medium"
  },
  {
    "id": "43333333-3333-4333-8333-333333333335",
    "title": "Document generated runtime checks",
    "description": "Capture how staged checks prove the stack is healthy.",
    "status": "closed",
    "closed_at": now,
    "priority": "low"
  },
  {
    "id": "43333333-3333-4333-8333-333333333336",
    "title": "Validate ownership guardrails",
    "description": "This seeded issue belongs to a different user so authorization checks can prove 403 behavior.",
    "status": "open",
    "assignee_id": "41111111-1111-4111-8111-111111111112",
    "closed_at": null,
    "priority": "medium"
  }
];

  for (const issue of issues) {
    await prisma.issue.upsert({
      where: { id: issue.id },
      update: {
        title: issue.title,
        description: issue.description,
        status: issue.status,
        assignee_id: issue.assignee_id === "41111111-1111-4111-8111-111111111112" ? forbiddenUserId : demoUserId,
        board_id: demoBoardId,
        priority: issue.priority,
        closed_at: issue.closed_at,
        updated_at: now
      },
      create: {
        id: issue.id,
        title: issue.title,
        description: issue.description,
        status: issue.status,
        assignee_id: issue.assignee_id === "41111111-1111-4111-8111-111111111112" ? forbiddenUserId : demoUserId,
        board_id: demoBoardId,
        created_at: now,
        updated_at: now,
        closed_at: issue.closed_at,
        priority: issue.priority
      }
    });
  }

  console.log(JSON.stringify({
    ok: true,
    demoUserId,
    forbiddenUserId,
    demoBoardId,
    demoIssueId,
    forbiddenIssueId,
    seededIssueCount: issues.length
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
