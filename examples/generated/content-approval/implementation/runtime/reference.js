import { CONTENT_APPROVAL_BACKEND_REFERENCE } from "../backend/reference.js";

export const CONTENT_APPROVAL_RUNTIME_REFERENCE = {
  localDbProjectionId: "proj_db_sqlite",
  serviceName: CONTENT_APPROVAL_BACKEND_REFERENCE.serviceName,
  ports: {
    server: 3002,
    web: 5175
  },
  environment: {
    name: "Content Approval Local Runtime Stack",
    databaseName: "topogram_content_approval",
    envExample: `# Demo-only credentials. Do not reuse these fixture secrets or tokens outside local/generated verification.
TOPOGRAM_AUTH_PROFILE=bearer_jwt_hs256
TOPOGRAM_AUTH_JWT_SECRET=topogram-content-approval-jwt-secret
TOPOGRAM_AUTH_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1MTExMTExMS0xMTExLTQxMTEtODExMS0xMTExMTExMTExMTEiLCJwZXJtaXNzaW9ucyI6WyJhcnRpY2xlcy5jcmVhdGUiLCJhcnRpY2xlcy5yZWFkIiwiYXJ0aWNsZXMuc3VibWl0IiwiYXJ0aWNsZXMucmVxdWVzdF9yZXZpc2lvbiIsImFydGljbGVzLmFwcHJvdmUiLCJhcnRpY2xlcy5yZWplY3QiXSwicm9sZXMiOlsibWFuYWdlciJdLCJhZG1pbiI6ZmFsc2UsImV4cCI6NDEwMjQ0NDgwMCwicmV2aWV3ZXIiOnRydWV9.k5II38W2N9HaeoeegOZ0LQ8y2-mWABFtcUFFHoNgyLE
TOPOGRAM_AUTH_TOKEN_NO_REVIEWER=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1MTExMTExMS0xMTExLTQxMTEtODExMS0xMTExMTExMTExMTEiLCJwZXJtaXNzaW9ucyI6WyJhcnRpY2xlcy5jcmVhdGUiLCJhcnRpY2xlcy5yZWFkIiwiYXJ0aWNsZXMuc3VibWl0IiwiYXJ0aWNsZXMucmVxdWVzdF9yZXZpc2lvbiIsImFydGljbGVzLmFwcHJvdmUiLCJhcnRpY2xlcy5yZWplY3QiXSwicm9sZXMiOlsibWFuYWdlciJdLCJhZG1pbiI6ZmFsc2UsImV4cCI6NDEwMjQ0NDgwMCwicmV2aWV3ZXIiOmZhbHNlfQ.pOaYZU9DX1_F84ZKJg_7b_QmtHjvHo7sIao-Nfwg5Js
PUBLIC_TOPOGRAM_DEMO_AUTH_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1MTExMTExMS0xMTExLTQxMTEtODExMS0xMTExMTExMTExMTEiLCJwZXJtaXNzaW9ucyI6WyJhcnRpY2xlcy5jcmVhdGUiLCJhcnRpY2xlcy5yZWFkIiwiYXJ0aWNsZXMuc3VibWl0IiwiYXJ0aWNsZXMucmVxdWVzdF9yZXZpc2lvbiIsImFydGljbGVzLmFwcHJvdmUiLCJhcnRpY2xlcy5yZWplY3QiXSwicm9sZXMiOlsibWFuYWdlciJdLCJhZG1pbiI6ZmFsc2UsImV4cCI6NDEwMjQ0NDgwMCwicmV2aWV3ZXIiOnRydWV9.k5II38W2N9HaeoeegOZ0LQ8y2-mWABFtcUFFHoNgyLE
PUBLIC_TOPOGRAM_DEMO_PRIMARY_ID=${CONTENT_APPROVAL_BACKEND_REFERENCE.demo.articleId}
PUBLIC_TOPOGRAM_DEMO_CONTAINER_ID=${CONTENT_APPROVAL_BACKEND_REFERENCE.demo.publicationId}
TOPOGRAM_DEMO_PRIMARY_ID=${CONTENT_APPROVAL_BACKEND_REFERENCE.demo.articleId}
TOPOGRAM_DEMO_CONTAINER_ID=${CONTENT_APPROVAL_BACKEND_REFERENCE.demo.publicationId}`
  },
  compileCheck: {
    name: "Content Approval Generated Compile Checks"
  },
  smoke: {
    name: "Content Approval Runtime Smoke Plan",
    bundleTitle: "Content Approval Runtime Smoke Bundle",
    defaultContainerEnvVar: "TOPOGRAM_DEMO_CONTAINER_ID",
    webPath: "/articles",
    expectText: "Content Approval",
    createPath: "/articles",
    getPathPrefix: "/articles/",
    listPath: "/articles",
    createPayload: {
      title: "Smoke Test Article",
      containerField: "publication_id",
      extraFields: {
        reviewer_id: "__DEMO_USER_ID__",
        category: "smoke"
      }
    }
  },
  runtimeCheck: {
    name: "Content Approval Runtime Check Plan",
    bundleTitle: "Content Approval Runtime Check Bundle",
    requiredEnv: [
      "TOPOGRAM_API_BASE_URL",
      "TOPOGRAM_WEB_BASE_URL",
      "TOPOGRAM_AUTH_PROFILE",
      "TOPOGRAM_AUTH_JWT_SECRET",
      "TOPOGRAM_AUTH_TOKEN",
      "TOPOGRAM_AUTH_TOKEN_NO_REVIEWER",
      "TOPOGRAM_DEMO_CONTAINER_ID",
      "TOPOGRAM_DEMO_PRIMARY_ID"
    ],
    demoContainerEnvVar: "TOPOGRAM_DEMO_CONTAINER_ID",
    demoPrimaryEnvVar: "TOPOGRAM_DEMO_PRIMARY_ID",
    lookupPaths: {
      publication: "/lookups/publications",
      user: "/lookups/users"
    },
    stageNotes: [
      {
        id: "environment",
        summary: "required env, browser-visible reviewer actions, web readiness, API health, API readiness, and DB-backed seeded article lookup"
      },
      {
        id: "api",
        summary: "article creation, review submission, request-revision, claim-gated approval, rejection, lookup endpoints, and negative cases"
      }
    ],
    notes: [
      "This example uses the generated bearer_jwt_hs256 auth profile so review claims travel through API and UI proof paths.",
      "Browser checks prove reviewer-only article actions are visible with the reviewer claim and hidden without it.",
      "Runtime checks verify a valid signed token without the reviewer claim is rejected with 403.",
      "Mutating checks create, update, request revision for, approve, and reject runtime-check articles.",
      "Runtime checks also verify the generated publication and reviewer lookup endpoints.",
      "Later stages are skipped if environment readiness fails.",
      "The generated server exposes both `/health` and `/ready`.",
      "Use the smoke bundle for a faster minimal confidence check.",
      "Use this runtime-check bundle for richer staged verification and JSON reporting."
    ]
  },
  appBundle: {
    name: "Topogram Content Approval App Bundle",
    demoContainerName: CONTENT_APPROVAL_BACKEND_REFERENCE.demo.publication.name,
    demoPrimaryTitle: CONTENT_APPROVAL_BACKEND_REFERENCE.demo.articles[0].title
  },
  demoEnv: {
    userId: CONTENT_APPROVAL_BACKEND_REFERENCE.demo.userId,
    containerId: CONTENT_APPROVAL_BACKEND_REFERENCE.demo.publicationId,
    primaryId: CONTENT_APPROVAL_BACKEND_REFERENCE.demo.articleId
  }
};
