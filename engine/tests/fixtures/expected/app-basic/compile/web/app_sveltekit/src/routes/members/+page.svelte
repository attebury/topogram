<script lang="ts">
  export let data;

  const buildNextHref = () => {
    if (!data.result.next_cursor) return null;
    const params = new URLSearchParams();
    if (data.filters.limit) params.set("limit", String(data.filters.limit));
    params.set("after", data.result.next_cursor);
    return `/members?${params.toString()}`;
  };

  const nextHref = buildNextHref();
</script>

<main>
  <div class="stack">
    <section class="card">
      <div class="button-row" style="justify-content: space-between;">
        <div>
          <h1>Members</h1>
          <p>This list screen was generated from `member_list`.</p>
        </div>
        <a class="button-link" href="/members/new">Create Member</a>
      </div>

      {#if data.result.items.length === 0}
        <div class="empty-state">
          <p><strong>No members yet</strong></p>
          <p class="muted">Create a member to start assigning work</p>
        </div>
      {:else}
        <ul class="item-list resource-list">
          {#each data.result.items as member}
            <li>
              <div class="item-meta resource-meta">
                <a href={'/members/' + member.id}><strong>{member.display_name}</strong></a>
                <span class="muted">{member.email}</span>
              </div>
              <span class="badge">{member.is_active ? "active" : "inactive"}</span>
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
