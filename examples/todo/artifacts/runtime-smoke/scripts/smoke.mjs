const apiBase = process.env.TOPOGRAM_API_BASE_URL || "";
const webBase = process.env.TOPOGRAM_WEB_BASE_URL || "";
const demoProjectId = process.env.TOPOGRAM_DEMO_PROJECT_ID || "22222222-2222-4222-8222-222222222222";

if (!apiBase || !webBase) {
  throw new Error("TOPOGRAM_API_BASE_URL and TOPOGRAM_WEB_BASE_URL are required");
}

async function expectStatus(response, expected, label) {
  if (response.status !== expected) {
    const body = await response.text();
    throw new Error(`${label} expected ${expected}, got ${response.status}: ${body}`);
  }
}

const webResponse = await fetch(new URL("/tasks", webBase));
await expectStatus(webResponse, 200, "web /tasks");
const webText = await webResponse.text();
if (!webText.includes("Tasks")) {
  throw new Error("web /tasks did not include expected page text");
}

const createResponse = await fetch(new URL("/tasks", apiBase), {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "Idempotency-Key": crypto.randomUUID()
  },
  body: JSON.stringify({
    title: "Smoke Test Task",
    project_id: demoProjectId
  })
});
await expectStatus(createResponse, 201, "create task");
const created = await createResponse.json();
if (!created.id) {
  throw new Error("create task response did not include id");
}

const getResponse = await fetch(new URL(`/tasks/${created.id}`, apiBase));
await expectStatus(getResponse, 200, "get task");

const listResponse = await fetch(new URL("/tasks", apiBase));
await expectStatus(listResponse, 200, "list tasks");

console.log(JSON.stringify({
  ok: true,
  createdTaskId: created.id
}, null, 2));
