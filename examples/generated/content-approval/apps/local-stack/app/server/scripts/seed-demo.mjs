import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const demoUserId = process.env.TOPOGRAM_DEMO_USER_ID || "51111111-1111-4111-8111-111111111111";
const demoPublicationId = process.env.TOPOGRAM_DEMO_CONTAINER_ID || "52222222-2222-4222-8222-222222222222";
const demoArticleId = process.env.TOPOGRAM_DEMO_PRIMARY_ID || "53333333-3333-4333-8333-333333333333";

async function main() {
  const now = new Date();

  await prisma.user.upsert({
    where: { email: "content-approval.demo@topogram.local" },
    update: {
      display_name: "Content Approval Reviewer",
      is_active: true
    },
    create: {
      id: demoUserId,
      email: "content-approval.demo@topogram.local",
      display_name: "Content Approval Reviewer",
      is_active: true,
      created_at: now
    }
  });

  await prisma.publication.upsert({
    where: { name: "Editorial Desk" },
    update: {
      status: "active",
      description: "Seeded publication for the generated Content Approval runtime"
    },
    create: {
      id: demoPublicationId,
      name: "Editorial Desk",
      description: "Seeded publication for the generated Content Approval runtime",
      status: "active",
      created_at: now
    }
  });

  const articles = [
  {
    "id": "53333333-3333-4333-8333-333333333333",
    "title": "Seeded Demo Article",
    "description": "This article was created by the generated demo seed script.",
    "status": "submitted",
    "submitted_at": now,
    "revision_requested_at": null,
    "approved_at": null,
    "rejected_at": null,
    "reviewer_notes": null,
    "category": "platform"
  },
  {
    "id": "53333333-3333-4333-8333-333333333334",
    "title": "Approval workflows need confidence",
    "description": "Verify reviewer assignment, submission, and approval flows in the generated web app.",
    "status": "approved",
    "submitted_at": now,
    "revision_requested_at": null,
    "approved_at": now,
    "rejected_at": null,
    "reviewer_notes": "Approved for publication after editorial review.",
    "category": "workflow"
  },
  {
    "id": "53333333-3333-4333-8333-333333333335",
    "title": "Rejected demo article",
    "description": "Used to prove reject-state rendering in the generated detail experience.",
    "status": "rejected",
    "submitted_at": now,
    "revision_requested_at": null,
    "approved_at": null,
    "rejected_at": now,
    "reviewer_notes": "Needs stronger supporting evidence before approval.",
    "category": "review"
  },
  {
    "id": "53333333-3333-4333-8333-333333333336",
    "title": "Needs revision demo article",
    "description": "Used to prove revision-request rendering and resubmission guidance in the generated app.",
    "status": "needs_revision",
    "submitted_at": now,
    "revision_requested_at": now,
    "approved_at": null,
    "rejected_at": null,
    "reviewer_notes": "Please add the missing screenshots and tighten the conclusion.",
    "category": "revision"
  }
];

  for (const article of articles) {
    await prisma.article.upsert({
      where: { id: article.id },
      update: {
        title: article.title,
        description: article.description,
        status: article.status,
        reviewer_id: demoUserId,
        publication_id: demoPublicationId,
        submitted_at: article.submitted_at,
        revision_requested_at: article.revision_requested_at,
        approved_at: article.approved_at,
        rejected_at: article.rejected_at,
        reviewer_notes: article.reviewer_notes,
        category: article.category,
        updated_at: now
      },
      create: {
        id: article.id,
        title: article.title,
        description: article.description,
        status: article.status,
        reviewer_id: demoUserId,
        publication_id: demoPublicationId,
        created_at: now,
        updated_at: now,
        submitted_at: article.submitted_at,
        revision_requested_at: article.revision_requested_at,
        approved_at: article.approved_at,
        rejected_at: article.rejected_at,
        reviewer_notes: article.reviewer_notes,
        category: article.category
      }
    });
  }

  console.log(JSON.stringify({
    ok: true,
    demoUserId,
    demoPublicationId,
    demoArticleId,
    seededArticleCount: articles.length
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
