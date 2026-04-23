export const ISSUES_BACKEND_REFERENCE = {
  serviceName: "topogram-issues-server",
  renderSeedScript() {
    const reference = ISSUES_BACKEND_REFERENCE;
    const serializedIssues = JSON.stringify(reference.demo.issues, null, 2).replace(/"NOW"/g, "now");
    return `import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const demoUserId = process.env.TOPOGRAM_DEMO_USER_ID || "${reference.demo.userId}";
const forbiddenUserId = process.env.TOPOGRAM_FORBIDDEN_USER_ID || "${reference.demo.forbiddenUserId}";
const demoBoardId = process.env.TOPOGRAM_DEMO_CONTAINER_ID || "${reference.demo.boardId}";
const demoIssueId = process.env.TOPOGRAM_DEMO_PRIMARY_ID || "${reference.demo.issueId}";
const forbiddenIssueId = process.env.TOPOGRAM_FORBIDDEN_PRIMARY_ID || "${reference.demo.forbiddenIssueId}";

async function main() {
  const now = new Date();

  await prisma.user.upsert({
    where: { email: "${reference.demo.user.email}" },
    update: {
      display_name: "${reference.demo.user.displayName}",
      is_active: true
    },
    create: {
      id: demoUserId,
      email: "${reference.demo.user.email}",
      display_name: "${reference.demo.user.displayName}",
      is_active: true,
      created_at: now
    }
  });

  await prisma.user.upsert({
    where: { email: "${reference.demo.forbiddenUser.email}" },
    update: {
      display_name: "${reference.demo.forbiddenUser.displayName}",
      is_active: true
    },
    create: {
      id: forbiddenUserId,
      email: "${reference.demo.forbiddenUser.email}",
      display_name: "${reference.demo.forbiddenUser.displayName}",
      is_active: true,
      created_at: now
    }
  });

  await prisma.board.upsert({
    where: { name: "${reference.demo.board.name}" },
    update: {
      status: "${reference.demo.board.status}",
      description: "${reference.demo.board.description}"
    },
    create: {
      id: demoBoardId,
      name: "${reference.demo.board.name}",
      description: "${reference.demo.board.description}",
      status: "${reference.demo.board.status}",
      created_at: now
    }
  });

  const issues = ${serializedIssues};

  for (const issue of issues) {
    await prisma.issue.upsert({
      where: { id: issue.id },
      update: {
        title: issue.title,
        description: issue.description,
        status: issue.status,
        assignee_id: issue.assignee_id === "${reference.demo.forbiddenUserId}" ? forbiddenUserId : demoUserId,
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
        assignee_id: issue.assignee_id === "${reference.demo.forbiddenUserId}" ? forbiddenUserId : demoUserId,
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
`;
  },
  demo: {
    userId: "41111111-1111-4111-8111-111111111111",
    forbiddenUserId: "41111111-1111-4111-8111-111111111112",
    boardId: "42222222-2222-4222-8222-222222222222",
    issueId: "43333333-3333-4333-8333-333333333333",
    forbiddenIssueId: "43333333-3333-4333-8333-333333333336",
    user: {
      email: "issues.demo@topogram.local",
      displayName: "Issues Demo User"
    },
    forbiddenUser: {
      email: "issues.restricted@topogram.local",
      displayName: "Issues Restricted User"
    },
    board: {
      name: "Platform Reliability",
      description: "Seeded demo board for the generated Issues runtime",
      status: "active"
    },
    issues: [
      {
        id: "43333333-3333-4333-8333-333333333333",
        title: "Seeded Demo Issue",
        description: "This issue was created by the generated demo seed script.",
        status: "open",
        closed_at: null,
        priority: "high"
      },
      {
        id: "43333333-3333-4333-8333-333333333334",
        title: "Improve issue filtering",
        description: "Verify board and assignee filters in the generated web app.",
        status: "in_progress",
        closed_at: null,
        priority: "medium"
      },
      {
        id: "43333333-3333-4333-8333-333333333335",
        title: "Document generated runtime checks",
        description: "Capture how staged checks prove the stack is healthy.",
        status: "closed",
        closed_at: "NOW",
        priority: "low"
      },
      {
        id: "43333333-3333-4333-8333-333333333336",
        title: "Validate ownership guardrails",
        description: "This seeded issue belongs to a different user so authorization checks can prove 403 behavior.",
        status: "open",
        assignee_id: "41111111-1111-4111-8111-111111111112",
        closed_at: null,
        priority: "medium"
      }
    ]
  }
};
