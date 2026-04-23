export const CONTENT_APPROVAL_BACKEND_REFERENCE = {
  serviceName: "topogram-content-approval-server",
  renderSeedScript() {
    const reference = CONTENT_APPROVAL_BACKEND_REFERENCE;
    const serializedArticles = JSON.stringify(reference.demo.articles, null, 2).replace(/"NOW"/g, "now");
    return `import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const demoUserId = process.env.TOPOGRAM_DEMO_USER_ID || "${reference.demo.userId}";
const demoPublicationId = process.env.TOPOGRAM_DEMO_CONTAINER_ID || "${reference.demo.publicationId}";
const demoArticleId = process.env.TOPOGRAM_DEMO_PRIMARY_ID || "${reference.demo.articleId}";

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

  await prisma.publication.upsert({
    where: { name: "${reference.demo.publication.name}" },
    update: {
      status: "${reference.demo.publication.status}",
      description: "${reference.demo.publication.description}"
    },
    create: {
      id: demoPublicationId,
      name: "${reference.demo.publication.name}",
      description: "${reference.demo.publication.description}",
      status: "${reference.demo.publication.status}",
      created_at: now
    }
  });

  const articles = ${serializedArticles};

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
`;
  },
  demo: {
    userId: "51111111-1111-4111-8111-111111111111",
    publicationId: "52222222-2222-4222-8222-222222222222",
    articleId: "53333333-3333-4333-8333-333333333333",
    user: {
      email: "content-approval.demo@topogram.local",
      displayName: "Content Approval Reviewer"
    },
    publication: {
      name: "Editorial Desk",
      description: "Seeded publication for the generated Content Approval runtime",
      status: "active"
    },
    articles: [
      {
        id: "53333333-3333-4333-8333-333333333333",
        title: "Seeded Demo Article",
        description: "This article was created by the generated demo seed script.",
        status: "submitted",
        submitted_at: "NOW",
        revision_requested_at: null,
        approved_at: null,
        rejected_at: null,
        reviewer_notes: null,
        category: "platform"
      },
      {
        id: "53333333-3333-4333-8333-333333333334",
        title: "Approval workflows need confidence",
        description: "Verify reviewer assignment, submission, and approval flows in the generated web app.",
        status: "approved",
        submitted_at: "NOW",
        revision_requested_at: null,
        approved_at: "NOW",
        rejected_at: null,
        reviewer_notes: "Approved for publication after editorial review.",
        category: "workflow"
      },
      {
        id: "53333333-3333-4333-8333-333333333335",
        title: "Rejected demo article",
        description: "Used to prove reject-state rendering in the generated detail experience.",
        status: "rejected",
        submitted_at: "NOW",
        revision_requested_at: null,
        approved_at: null,
        rejected_at: "NOW",
        reviewer_notes: "Needs stronger supporting evidence before approval.",
        category: "review"
      },
      {
        id: "53333333-3333-4333-8333-333333333336",
        title: "Needs revision demo article",
        description: "Used to prove revision-request rendering and resubmission guidance in the generated app.",
        status: "needs_revision",
        submitted_at: "NOW",
        revision_requested_at: "NOW",
        approved_at: null,
        rejected_at: null,
        reviewer_notes: "Please add the missing screenshots and tighten the conclusion.",
        category: "revision"
      }
    ]
  }
};
