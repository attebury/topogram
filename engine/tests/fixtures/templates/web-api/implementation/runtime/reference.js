import { HELLO_BACKEND_REFERENCE } from "../backend/reference.js";

export const HELLO_RUNTIME_REFERENCE = {
  localDbProjectionId: "proj_db_postgres",
  serviceName: HELLO_BACKEND_REFERENCE.serviceName,
  ports: {
    server: 3000,
    web: 5173
  },
  environment: {
    name: "Starter Local Runtime Stack",
    databaseName: "topogram_starter",
    envExample: `PUBLIC_TOPOGRAM_DEMO_PRIMARY_ID=${HELLO_BACKEND_REFERENCE.demo.greetingId}
TOPOGRAM_DEMO_PRIMARY_ID=${HELLO_BACKEND_REFERENCE.demo.greetingId}
TOPOGRAM_DEMO_MESSAGE=${HELLO_BACKEND_REFERENCE.demo.message}`
  },
  compileCheck: {
    name: "Starter Generated Compile Checks"
  },
  smoke: {
    name: "Starter Runtime Smoke Plan",
    bundleTitle: "Starter Runtime Smoke Bundle",
    defaultContainerEnvVar: "TOPOGRAM_DEMO_MESSAGE",
    webPath: "/",
    expectText: "Topogram Starter",
    createPath: "/greetings",
    getPathPrefix: "/greetings/",
    listPath: "/greetings",
    createPayload: {
      title: "Smoke Test Greeting",
      containerField: "message"
    }
  },
  runtimeCheck: {
    name: "Starter Runtime Check Plan",
    bundleTitle: "Starter Runtime Check Bundle",
    requiredEnv: [
      "TOPOGRAM_API_BASE_URL",
      "TOPOGRAM_WEB_BASE_URL",
      "TOPOGRAM_DEMO_PRIMARY_ID"
    ],
    demoContainerEnvVar: "TOPOGRAM_DEMO_MESSAGE",
    demoPrimaryEnvVar: "TOPOGRAM_DEMO_PRIMARY_ID",
    lookupPaths: {},
    stageNotes: [
      {
        id: "environment",
        summary: "required env, web readiness, API health, API readiness, and seeded greeting lookup"
      },
      {
        id: "api",
        summary: "core greeting create, get, list, and update paths"
      }
    ],
    notes: [
      "Mutating checks create and update a runtime-check greeting.",
      "Later stages are skipped if environment readiness fails.",
      "The generated server exposes both `/health` and `/ready`.",
      "Use the smoke bundle for a faster minimal confidence check.",
      "Use this runtime-check bundle for staged verification and JSON reporting."
    ]
  },
  appBundle: {
    name: "Topogram Starter App Bundle",
    demoContainerName: HELLO_BACKEND_REFERENCE.demo.message,
    demoPrimaryTitle: HELLO_BACKEND_REFERENCE.demo.message
  },
  demoEnv: {
    userId: "",
    containerId: HELLO_BACKEND_REFERENCE.demo.message,
    primaryId: HELLO_BACKEND_REFERENCE.demo.greetingId
  }
};
