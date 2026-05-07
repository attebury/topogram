<script lang="ts">
  export let data;
  export let form;

  const values = form?.values ?? data.values;
</script>

<main>
  <div class="stack">
    <section class="card">
      <h1>Edit Member</h1>
      <p>Update the mutable fields for <strong>{data.member.display_name}</strong>.</p>
      {#if form?.error}<p><strong>{form.error}</strong></p>{/if}
      <form class="stack" method="POST">
        <label>Email <input name="email" type="email" value={values.email ?? ""} /></label>
        <label>Display Name <input name="display_name" value={values.display_name ?? ""} /></label>
        <label>
          Active
          <select name="is_active">
            <option value="true" selected={(values.is_active ?? data.member.is_active) === true}>active</option>
            <option value="false" selected={(values.is_active ?? data.member.is_active) === false}>inactive</option>
          </select>
        </label>
        <div class="button-row">
          <button type="submit">Save Changes</button>
          <a class="button-link secondary" href={"/members/" + data.member.id}>Cancel</a>
        </div>
      </form>
    </section>
  </div>
</main>
