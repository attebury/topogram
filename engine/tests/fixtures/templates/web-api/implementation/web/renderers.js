export function renderHelloHomePage({
  useTypescript,
  demoPrimaryEnvVar,
  screens,
  projectionName,
  homeDescription
}) {
  return `<script${useTypescript ? ' lang="ts"' : ""}>
  import { ${demoPrimaryEnvVar} as DEMO_GREETING_ID } from "$env/static/public";

  const screens = ${JSON.stringify(screens, null, 2)};
</script>

<main>
  <div class="stack">
    <section class="card hero">
      <div>
        <p class="muted">Generated starter</p>
        <h1>Topogram Starter</h1>
        <p>${homeDescription}</p>
      </div>
      <div class="button-row">
        <a class="button-link" href="/greetings">View API route</a>
        {#if DEMO_GREETING_ID}
          <span class="badge">Seed: {DEMO_GREETING_ID}</span>
        {/if}
      </div>
    </section>

    <section class="grid two">
      {#each screens as screen}
        <article class="card">
          <h2>{screen.title}</h2>
          <p class="muted">{screen.route || "Contract-only screen"}</p>
        </article>
      {/each}
    </section>
  </div>
</main>
`;
}

export function renderHelloRoutes() {
  return {};
}
