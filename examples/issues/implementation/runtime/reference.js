import { ISSUES_BACKEND_REFERENCE } from "../backend/reference.js";

export const ISSUES_RUNTIME_REFERENCE = {
  localDbProjectionId: "proj_db_sqlite",
  serviceName: ISSUES_BACKEND_REFERENCE.serviceName,
  ports: {
    server: 3001,
    web: 5174
  },
  environment: {
    name: "Issues Local Runtime Stack",
    databaseName: "topogram_issues",
    envExample: `TOPOGRAM_AUTH_PROFILE=bearer_jwt_hs256
TOPOGRAM_AUTH_JWT_SECRET=topogram-issues-jwt-secret
TOPOGRAM_AUTH_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0MTExMTExMS0xMTExLTQxMTEtODExMS0xMTExMTExMTExMTEiLCJwZXJtaXNzaW9ucyI6WyJpc3N1ZXMuY3JlYXRlIiwiaXNzdWVzLnJlYWQiLCJpc3N1ZXMudXBkYXRlIiwiaXNzdWVzLmNsb3NlIl0sInJvbGVzIjpbXSwiYWRtaW4iOmZhbHNlLCJleHAiOjQxMDI0NDQ4MDB9.3aRZHKGyonZ6MFCIWjTR4caj4pjkWNtQW-Wb-y_qzwI
TOPOGRAM_AUTH_TOKEN_EXPIRED=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0MTExMTExMS0xMTExLTQxMTEtODExMS0xMTExMTExMTExMTEiLCJwZXJtaXNzaW9ucyI6WyJpc3N1ZXMuY3JlYXRlIiwiaXNzdWVzLnJlYWQiLCJpc3N1ZXMudXBkYXRlIiwiaXNzdWVzLmNsb3NlIl0sInJvbGVzIjpbXSwiYWRtaW4iOmZhbHNlLCJleHAiOjE1Nzc4MzY4MDB9.PNrRsj3_d1WYAJCTBUb1eMIzJKO7dM1twKxrkim0HnM
TOPOGRAM_AUTH_TOKEN_INVALID=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0MTExMTExMS0xMTExLTQxMTEtODExMS0xMTExMTExMTExMTEiLCJwZXJtaXNzaW9ucyI6WyJpc3N1ZXMuY3JlYXRlIiwiaXNzdWVzLnJlYWQiLCJpc3N1ZXMudXBkYXRlIiwiaXNzdWVzLmNsb3NlIl0sInJvbGVzIjpbXSwiYWRtaW4iOmZhbHNlLCJleHAiOjQxMDI0NDQ4MDB9.3aRZHKGyonZ6MFCIWjTR4caj4pjkWNtQW-Wb-y_qzwa
PUBLIC_TOPOGRAM_AUTH_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0MTExMTExMS0xMTExLTQxMTEtODExMS0xMTExMTExMTExMTEiLCJwZXJtaXNzaW9ucyI6WyJpc3N1ZXMuY3JlYXRlIiwiaXNzdWVzLnJlYWQiLCJpc3N1ZXMudXBkYXRlIiwiaXNzdWVzLmNsb3NlIl0sInJvbGVzIjpbXSwiYWRtaW4iOmZhbHNlLCJleHAiOjQxMDI0NDQ4MDB9.3aRZHKGyonZ6MFCIWjTR4caj4pjkWNtQW-Wb-y_qzwI
PUBLIC_TOPOGRAM_DEMO_PRIMARY_ID=${ISSUES_BACKEND_REFERENCE.demo.issueId}
PUBLIC_TOPOGRAM_FORBIDDEN_PRIMARY_ID=${ISSUES_BACKEND_REFERENCE.demo.forbiddenIssueId}
PUBLIC_TOPOGRAM_DEMO_CONTAINER_ID=${ISSUES_BACKEND_REFERENCE.demo.boardId}
TOPOGRAM_DEMO_PRIMARY_ID=${ISSUES_BACKEND_REFERENCE.demo.issueId}
TOPOGRAM_FORBIDDEN_USER_ID=${ISSUES_BACKEND_REFERENCE.demo.forbiddenUserId}
TOPOGRAM_FORBIDDEN_PRIMARY_ID=${ISSUES_BACKEND_REFERENCE.demo.forbiddenIssueId}
TOPOGRAM_DEMO_CONTAINER_ID=${ISSUES_BACKEND_REFERENCE.demo.boardId}`
  },
  compileCheck: {
    name: "Issues Generated Compile Checks"
  },
  smoke: {
    name: "Issues Runtime Smoke Plan",
    bundleTitle: "Issues Runtime Smoke Bundle",
    defaultContainerEnvVar: "TOPOGRAM_DEMO_CONTAINER_ID",
    webPath: "/issues",
    expectText: "Issues",
    createPath: "/issues",
    getPathPrefix: "/issues/",
    listPath: "/issues",
    createPayload: {
      title: "Smoke Test Issue",
      containerField: "board_id",
      extraFields: {
        priority: "medium"
      }
    }
  },
  runtimeCheck: {
    name: "Issues Runtime Check Plan",
    bundleTitle: "Issues Runtime Check Bundle",
    requiredEnv: [
      "TOPOGRAM_API_BASE_URL",
      "TOPOGRAM_WEB_BASE_URL",
      "TOPOGRAM_AUTH_PROFILE",
      "TOPOGRAM_AUTH_JWT_SECRET",
      "TOPOGRAM_AUTH_TOKEN",
      "TOPOGRAM_DEMO_CONTAINER_ID",
      "TOPOGRAM_DEMO_PRIMARY_ID",
      "TOPOGRAM_FORBIDDEN_USER_ID"
    ],
    demoContainerEnvVar: "TOPOGRAM_DEMO_CONTAINER_ID",
    demoPrimaryEnvVar: "TOPOGRAM_DEMO_PRIMARY_ID",
    lookupPaths: {
      board: "/lookups/boards",
      user: "/lookups/users"
    },
    stageNotes: [
      {
        id: "environment",
        summary: "required env, web readiness, browser-visible issue detail actions, API health, API readiness, and DB-backed seeded issue lookup"
      },
      {
        id: "api",
        summary: "core issue happy paths, generated lookup endpoints, and important negative cases"
      }
    ],
    notes: [
      "This example uses the generated bearer_jwt_hs256 auth profile for secured API checks.",
      "Browser checks drive the live React/Vite detail page through Safari to prove visible and hidden issue actions.",
      "The forbidden-path proof uses a seeded issue that belongs to a different user.",
      "Runtime checks also verify invalid-signature and expired-token failures.",
      "Mutating checks create, update, and close a runtime-check issue.",
      "Runtime checks also verify the generated board and user lookup endpoints.",
      "Later stages are skipped if environment readiness fails.",
      "The generated server exposes both `/health` and `/ready`.",
      "Use the smoke bundle for a faster minimal confidence check.",
      "Use this runtime-check bundle for richer staged verification and JSON reporting."
    ]
  },
  appBundle: {
    name: "Topogram Issues App Bundle",
    demoContainerName: ISSUES_BACKEND_REFERENCE.demo.board.name,
    demoPrimaryTitle: ISSUES_BACKEND_REFERENCE.demo.issues[0].title
  },
  demoEnv: {
    userId: ISSUES_BACKEND_REFERENCE.demo.userId,
    containerId: ISSUES_BACKEND_REFERENCE.demo.boardId,
    primaryId: ISSUES_BACKEND_REFERENCE.demo.issueId
  }
};
