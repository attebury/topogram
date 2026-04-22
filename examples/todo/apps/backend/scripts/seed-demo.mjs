import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const demoUserId = process.env.TOPOGRAM_DEMO_USER_ID || "11111111-1111-4111-8111-111111111111";
const demoProjectId = process.env.TOPOGRAM_DEMO_CONTAINER_ID || "22222222-2222-4222-8222-222222222222";
const demoTaskId = process.env.TOPOGRAM_DEMO_PRIMARY_ID || "33333333-3333-4333-8333-333333333333";

async function main() {
  const now = new Date();

  await prisma.user.upsert({
    where: { email: "demo.user@topogram.local" },
    update: {
      display_name: "Demo User",
      is_active: true
    },
    create: {
      id: demoUserId,
      email: "demo.user@topogram.local",
      display_name: "Demo User",
      is_active: true,
      created_at: now
    }
  });

  await prisma.project.upsert({
    where: { name: "Demo Project" },
    update: {
      status: "active",
      description: "Seeded demo project for the generated Todo runtime",
      owner_id: demoUserId
    },
    create: {
      id: demoProjectId,
      name: "Demo Project",
      description: "Seeded demo project for the generated Todo runtime",
      status: "active",
      owner_id: demoUserId,
      created_at: now
    }
  });

  const tasks = [
  {
    "id": "33333333-3333-4333-8333-333333333333",
    "title": "Seeded Demo Task",
    "description": "This task was created by the generated demo seed script.",
    "priority": "high",
    "status": "active",
    "completed_at": null,
    "due_at": null
  },
  {
    "id": "33333333-3333-4333-8333-333333333334",
    "title": "Plan release notes",
    "description": "Collect the key v0.1 highlights for the generated app bundle.",
    "priority": "medium",
    "status": "draft",
    "completed_at": null,
    "due_at": null
  },
  {
    "id": "33333333-3333-4333-8333-333333333335",
    "title": "Review generated OpenAPI",
    "description": "Check that the latest OpenAPI output matches the shipped runtime.",
    "priority": "high",
    "status": "active",
    "completed_at": null,
    "due_at": null
  },
  {
    "id": "33333333-3333-4333-8333-333333333336",
    "title": "Write onboarding guide",
    "description": "Summarize the golden path for a new team adopting the generated stack.",
    "priority": "medium",
    "status": "active",
    "completed_at": null,
    "due_at": null
  },
  {
    "id": "33333333-3333-4333-8333-333333333337",
    "title": "Verify local process profile",
    "description": "Confirm the no-Docker environment profile still works after recent changes.",
    "priority": "low",
    "status": "completed",
    "completed_at": now,
    "due_at": null
  },
  {
    "id": "33333333-3333-4333-8333-333333333338",
    "title": "Create export fixtures",
    "description": "Seed a few realistic export records for smoke testing.",
    "priority": "medium",
    "status": "draft",
    "completed_at": null,
    "due_at": null
  },
  {
    "id": "33333333-3333-4333-8333-333333333339",
    "title": "Polish generated homepage",
    "description": "Improve the first-run experience with direct seeded shortcuts.",
    "priority": "low",
    "status": "completed",
    "completed_at": now,
    "due_at": null
  },
  {
    "id": "33333333-3333-4333-8333-333333333340",
    "title": "Audit runtime smoke checks",
    "description": "Expand smoke coverage for core task actions.",
    "priority": "high",
    "status": "active",
    "completed_at": null,
    "due_at": null
  },
  {
    "id": "33333333-3333-4333-8333-333333333341",
    "title": "Draft deployment checklist",
    "description": "Capture the minimum steps for shipping the generated app.",
    "priority": "medium",
    "status": "draft",
    "completed_at": null,
    "due_at": null
  },
  {
    "id": "33333333-3333-4333-8333-333333333342",
    "title": "Capture user feedback",
    "description": "Collect notes from the first walkthrough of the generated UX.",
    "priority": "high",
    "status": "active",
    "completed_at": null,
    "due_at": null
  }
];

  for (const task of tasks) {
    await prisma.task.upsert({
      where: { id: task.id },
      update: {
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        owner_id: demoUserId,
        project_id: demoProjectId,
        completed_at: task.completed_at,
        due_at: task.due_at,
        updated_at: now
      },
      create: {
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        owner_id: demoUserId,
        project_id: demoProjectId,
        created_at: now,
        updated_at: now,
        completed_at: task.completed_at,
        due_at: task.due_at
      }
    });
  }

  console.log(JSON.stringify({
    ok: true,
    demoUserId,
    demoProjectId,
    demoTaskId,
    seededTaskCount: tasks.length
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
