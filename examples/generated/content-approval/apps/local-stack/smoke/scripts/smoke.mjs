const apiBase = process.env.TOPOGRAM_API_BASE_URL || "";
const webBase = process.env.TOPOGRAM_WEB_BASE_URL || "";
const demoContainerId = process.env.TOPOGRAM_DEMO_CONTAINER_ID || "52222222-2222-4222-8222-222222222222";
const authToken = process.env.TOPOGRAM_AUTH_TOKEN || process.env.PUBLIC_TOPOGRAM_AUTH_TOKEN || "";

if (!apiBase || !webBase) {
  throw new Error("TOPOGRAM_API_BASE_URL and TOPOGRAM_WEB_BASE_URL are required");
}

async function expectStatus(response, expected, label) {
  if (response.status !== expected) {
    const body = await response.text();
    throw new Error(`${label} expected ${expected}, got ${response.status}: ${body}`);
  }
}

const webResponse = await fetch(new URL("/articles", webBase));
await expectStatus(webResponse, 200, "web page");
const webText = await webResponse.text();
if (!webText.includes("Articles")) {
  throw new Error("web page did not include expected page text");
}

const createResponse = await fetch(new URL("/articles", apiBase), {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "Idempotency-Key": crypto.randomUUID(),
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
  },
  body: JSON.stringify({
    title: "Smoke Test Article",
    publication_id: demoContainerId,
    category: "smoke"
  })
});
await expectStatus(createResponse, 201, "create resource");
const created = await createResponse.json();
if (!created.id) {
  throw new Error("create resource response did not include id");
}

const getResponse = await fetch(new URL(`/articles/${created.id}`, apiBase), {
  headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined
});
await expectStatus(getResponse, 200, "get resource");

const listResponse = await fetch(new URL("/articles", apiBase), {
  headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined
});
await expectStatus(listResponse, 200, "list resources");

console.log(JSON.stringify({
  ok: true,
  createdPrimaryId: created.id
}, null, 2));
