<script lang="ts">
  export let data;
</script>

<main>
  <div class="stack">
    <section class="card">
      <div class="button-row" style="justify-content: space-between;">
        <div>
          <h1>{data.member.display_name}</h1>
          <p>This detail screen was generated from `member_detail`.</p>
        </div>
        <span class="badge">{data.member.is_active ? "active" : "inactive"}</span>
      </div>

      <dl class="definition-list">
        <dt>Member ID</dt><dd>{data.member.id}</dd>
        <dt>Email</dt><dd>{data.member.email}</dd>
        <dt>Display Name</dt><dd>{data.member.display_name}</dd>
        <dt>Created</dt><dd>{data.member.created_at}</dd>
      </dl>

      <div class="button-row">
        <a class="button-link secondary" href="/members">Back to Members</a>
        <a class="button-link" href={"/members/" + data.member.id + "/edit"}>Edit Member</a>
      </div>
    </section>
  </div>
</main>
