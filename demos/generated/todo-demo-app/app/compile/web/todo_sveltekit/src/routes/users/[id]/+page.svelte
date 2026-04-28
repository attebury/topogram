<script lang="ts">
  export let data;
</script>

<main>
  <div class="stack">
    <section class="card">
      <div class="button-row" style="justify-content: space-between;">
        <div>
          <h1>{data.user.display_name}</h1>
          <p>This detail screen was generated from `user_detail`.</p>
        </div>
        <span class="badge">{data.user.is_active ? "active" : "inactive"}</span>
      </div>

      <dl class="definition-list">
        <dt>User ID</dt><dd>{data.user.id}</dd>
        <dt>Email</dt><dd>{data.user.email}</dd>
        <dt>Display Name</dt><dd>{data.user.display_name}</dd>
        <dt>Created</dt><dd>{data.user.created_at}</dd>
      </dl>

      <div class="button-row">
        <a class="button-link secondary" href="/users">Back to Users</a>
        <a class="button-link" href={"/users/" + data.user.id + "/edit"}>Edit User</a>
      </div>
    </section>
  </div>
</main>
