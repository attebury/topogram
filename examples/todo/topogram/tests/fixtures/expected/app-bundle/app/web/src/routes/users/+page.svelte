<script lang="ts">
  export let data;

  const buildNextHref = () => {
    if (!data.result.next_cursor) return null;
    const params = new URLSearchParams();
    if (data.filters.limit) params.set("limit", String(data.filters.limit));
    params.set("after", data.result.next_cursor);
    return `/users?${params.toString()}`;
  };

  const nextHref = buildNextHref();
</script>

<main>
  <div class="stack">
    <section class="card">
      <div class="button-row" style="justify-content: space-between;">
        <div>
          <h1>Users</h1>
          <p>This list screen was generated from `user_list`.</p>
        </div>
        <a class="button-link" href="/users/new">Create User</a>
      </div>

      {#if data.result.items.length === 0}
        <div class="empty-state">
          <p><strong>No users yet</strong></p>
          <p class="muted">Create a user to start assigning work</p>
        </div>
      {:else}
        <ul class="task-list resource-list">
          {#each data.result.items as user}
            <li>
              <div class="task-meta resource-meta">
                <a href={'/users/' + user.id}><strong>{user.display_name}</strong></a>
                <span class="muted">{user.email}</span>
              </div>
              <span class="badge">{user.is_active ? "active" : "inactive"}</span>
            </li>
          {/each}
        </ul>
        {#if nextHref}
          <p><a class="button-link secondary" href={nextHref}>Next Page</a></p>
        {/if}
      {/if}
    </section>
  </div>
</main>
