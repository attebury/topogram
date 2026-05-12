const app = {
  get() {},
  post() {}
};

app.get("/test-only", testOnlyHandler);
app.post("/test-only", testOnlyHandler);

function testOnlyHandler() {
  return { ok: true };
}
