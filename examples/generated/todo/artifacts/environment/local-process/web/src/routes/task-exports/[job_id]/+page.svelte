<script lang="ts">
  export let data;
</script>

<main>
  <div class="stack">
    <section class="card">
      <h1>Export Status</h1>
      <p>This job status screen was generated from `task_exports`.</p>
      {#if data.notFound}
        <p>No export job was found for this id yet.</p>
        <p class="muted">Start an export from a future generated action or revisit this page with a valid job id.</p>
      {:else}
        <dl class="definition-list">
          <dt>Status</dt><dd><span class="badge">{data.job.status}</span></dd>
          <dt>Submitted</dt><dd>{data.job.submitted_at}</dd>
          {#if data.job.completed_at}<dt>Completed</dt><dd>{data.job.completed_at}</dd>{/if}
          {#if data.job.error_message}<dt>Error</dt><dd>{data.job.error_message}</dd>{/if}
        </dl>
        {#if data.job.download_url}
          <p><a class="button-link" href={data.job.download_url}>Download Export</a></p>
        {/if}
      {/if}
    </section>
  </div>
</main>
