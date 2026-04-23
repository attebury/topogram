<script lang="ts">
  export let form;

  const values = {
    email: form?.values?.email ?? "",
    display_name: form?.values?.display_name ?? "",
    is_active: form?.values?.is_active ?? true
  };
</script>

<main>
  <div class="stack">
    <section class="card">
      <h1>Create User</h1>
      <p>This form screen was generated from `user_create`.</p>
      {#if form?.error}<p><strong>{form.error}</strong></p>{/if}
      <form class="stack" method="POST">
        <label>Email <input name="email" type="email" required value={values.email} /></label>
        <label>Display Name <input name="display_name" required value={values.display_name} /></label>
        <label>
          Active
          <select name="is_active">
            <option value="true" selected={values.is_active === true}>active</option>
            <option value="false" selected={values.is_active === false}>inactive</option>
          </select>
        </label>
        <div class="button-row">
          <button type="submit">Create User</button>
          <a class="button-link secondary" href="/users">Cancel</a>
        </div>
      </form>
    </section>
  </div>
</main>
