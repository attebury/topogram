import { TODO_BACKEND_REFERENCE } from "../backend/reference.js";

export const TODO_RUNTIME_REFERENCE = {
  localDbProjectionId: "proj_db_postgres",
  serviceName: TODO_BACKEND_REFERENCE.serviceName,
  ports: {
    server: 3000,
    web: 5173
  },
  environment: {
    name: "Todo Local Runtime Stack",
    databaseName: "topogram_todo",
    envExample: `TOPOGRAM_AUTH_PROFILE=bearer_demo
TOPOGRAM_AUTH_TOKEN=topogram-todo-demo-token
TOPOGRAM_AUTH_USER_ID=${TODO_BACKEND_REFERENCE.demo.userId}
TOPOGRAM_AUTH_PERMISSIONS=*
PUBLIC_TOPOGRAM_AUTH_TOKEN=topogram-todo-demo-token
PUBLIC_TOPOGRAM_AUTH_USER_ID=${TODO_BACKEND_REFERENCE.demo.userId}
PUBLIC_TOPOGRAM_AUTH_PERMISSIONS=*
PUBLIC_TOPOGRAM_DEMO_PRIMARY_ID=${TODO_BACKEND_REFERENCE.demo.taskId}
PUBLIC_TOPOGRAM_DEMO_CONTAINER_ID=${TODO_BACKEND_REFERENCE.demo.projectId}
TOPOGRAM_DEMO_PRIMARY_ID=${TODO_BACKEND_REFERENCE.demo.taskId}
TOPOGRAM_DEMO_CONTAINER_ID=${TODO_BACKEND_REFERENCE.demo.projectId}`
  },
  compileCheck: {
    name: "Todo Generated Compile Checks"
  },
  smoke: {
    name: "Todo Runtime Smoke Plan",
    bundleTitle: "Todo Runtime Smoke Bundle",
    defaultContainerEnvVar: "TOPOGRAM_DEMO_CONTAINER_ID",
    webPath: "/tasks",
    expectText: "Tasks",
    createPath: "/tasks",
    getPathPrefix: "/tasks/",
    listPath: "/tasks",
    createPayload: {
      title: "Smoke Test Task",
      containerField: "project_id"
    }
  },
  runtimeCheck: {
    name: "Todo Runtime Check Plan",
    bundleTitle: "Todo Runtime Check Bundle",
    requiredEnv: [
      "TOPOGRAM_API_BASE_URL",
      "TOPOGRAM_WEB_BASE_URL",
      "TOPOGRAM_DEMO_CONTAINER_ID",
      "TOPOGRAM_DEMO_PRIMARY_ID"
    ],
    demoContainerEnvVar: "TOPOGRAM_DEMO_CONTAINER_ID",
    demoPrimaryEnvVar: "TOPOGRAM_DEMO_PRIMARY_ID",
    lookupPaths: {
      project: "/lookups/projects",
      user: "/lookups/users"
    },
    stageNotes: [
      {
        id: "environment",
        summary: "required env, web readiness, API health, API readiness, and DB-backed seeded task lookup"
      },
      {
        id: "api",
        summary: "core task happy paths, export/job flows, generated lookup endpoints, and important negative cases"
      }
    ],
    notes: [
      "Mutating checks create, update, complete, and archive a runtime-check task.",
      "Export checks submit a task export job, verify job status, and verify the download endpoint.",
      "Runtime checks also verify the generated project and user lookup endpoints.",
      "Later stages are skipped if environment readiness fails.",
      "The generated server exposes both `/health` and `/ready`.",
      "Use the smoke bundle for a faster minimal confidence check.",
      "Use this runtime-check bundle for richer staged verification and JSON reporting."
    ]
  },
  appBundle: {
    name: "Topogram Todo App Bundle",
    demoContainerName: TODO_BACKEND_REFERENCE.demo.project.name,
    demoPrimaryTitle: TODO_BACKEND_REFERENCE.demo.tasks[0].title
  },
  demoEnv: {
    userId: TODO_BACKEND_REFERENCE.demo.userId,
    containerId: TODO_BACKEND_REFERENCE.demo.projectId,
    primaryId: TODO_BACKEND_REFERENCE.demo.taskId
  }
};
