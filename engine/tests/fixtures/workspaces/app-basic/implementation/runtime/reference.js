import { APP_BASIC_BACKEND_REFERENCE } from "../backend/reference.js";

export const APP_BASIC_RUNTIME_REFERENCE = {
  localDbProjectionId: "proj_db_postgres",
  serviceName: APP_BASIC_BACKEND_REFERENCE.serviceName,
  ports: {
    server: 3000,
    web: 5173
  },
  environment: {
    name: "Sample Workspace Local Runtime Stack",
    databaseName: "topogram_sample_workspace",
    envExample: `TOPOGRAM_AUTH_PROFILE=bearer_demo
TOPOGRAM_AUTH_TOKEN=topogram-sample-workspace-demo-token
TOPOGRAM_AUTH_USER_ID=${APP_BASIC_BACKEND_REFERENCE.demo.memberId}
TOPOGRAM_AUTH_PERMISSIONS=*
PUBLIC_TOPOGRAM_AUTH_TOKEN=topogram-sample-workspace-demo-token
PUBLIC_TOPOGRAM_AUTH_USER_ID=${APP_BASIC_BACKEND_REFERENCE.demo.memberId}
PUBLIC_TOPOGRAM_AUTH_PERMISSIONS=*
PUBLIC_TOPOGRAM_DEMO_PRIMARY_ID=${APP_BASIC_BACKEND_REFERENCE.demo.itemId}
PUBLIC_TOPOGRAM_DEMO_CONTAINER_ID=${APP_BASIC_BACKEND_REFERENCE.demo.collectionId}
TOPOGRAM_DEMO_PRIMARY_ID=${APP_BASIC_BACKEND_REFERENCE.demo.itemId}
TOPOGRAM_DEMO_CONTAINER_ID=${APP_BASIC_BACKEND_REFERENCE.demo.collectionId}`
  },
  compileCheck: {
    name: "Sample Workspace Generated Compile Checks"
  },
  smoke: {
    name: "Sample Workspace Runtime Smoke Plan",
    bundleTitle: "Sample Workspace Runtime Smoke Bundle",
    defaultContainerEnvVar: "TOPOGRAM_DEMO_CONTAINER_ID",
    webPath: "/items",
    expectText: "Items",
    createPath: "/items",
    getPathPrefix: "/items/",
    listPath: "/items",
    createPayload: {
      title: "Smoke Test Item",
      containerField: "collection_id"
    }
  },
  runtimeCheck: {
    name: "Sample Workspace Runtime Check Plan",
    bundleTitle: "Sample Workspace Runtime Check Bundle",
    requiredEnv: [
      "TOPOGRAM_API_BASE_URL",
      "TOPOGRAM_WEB_BASE_URL",
      "TOPOGRAM_DEMO_CONTAINER_ID",
      "TOPOGRAM_DEMO_PRIMARY_ID"
    ],
    demoContainerEnvVar: "TOPOGRAM_DEMO_CONTAINER_ID",
    demoPrimaryEnvVar: "TOPOGRAM_DEMO_PRIMARY_ID",
    lookupPaths: {
      collection: "/lookups/collections",
      member: "/lookups/members"
    },
    stageNotes: [
      {
        id: "environment",
        summary: "required env, web readiness, API health, API readiness, and DB-backed seeded item lookup"
      },
      {
        id: "api",
        summary: "core item happy paths, export/job flows, generated lookup endpoints, and important negative cases"
      }
    ],
    notes: [
      "Mutating checks create, update, complete, and archive a runtime-check item.",
      "Export checks submit a item export job, verify job status, and verify the download endpoint.",
      "Runtime checks also verify the generated collection and member lookup endpoints.",
      "Later stages are skipped if environment readiness fails.",
      "The generated server exposes both `/health` and `/ready`.",
      "Use the smoke bundle for a faster minimal confidence check.",
      "Use this runtime-check bundle for richer staged verification and JSON reporting."
    ]
  },
  appBundle: {
    name: "Topogram Sample Workspace App Bundle",
    demoContainerName: APP_BASIC_BACKEND_REFERENCE.demo.collection.name,
    demoPrimaryTitle: APP_BASIC_BACKEND_REFERENCE.demo.items[0].title
  },
  demoEnv: {
    memberId: APP_BASIC_BACKEND_REFERENCE.demo.memberId,
    containerId: APP_BASIC_BACKEND_REFERENCE.demo.collectionId,
    primaryId: APP_BASIC_BACKEND_REFERENCE.demo.itemId
  }
};
