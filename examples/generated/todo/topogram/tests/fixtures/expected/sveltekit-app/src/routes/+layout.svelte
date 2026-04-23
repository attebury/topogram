<script lang="ts">
  import "../app.css";
</script>

<div class="app-shell">
  <header class="app-nav">
    <a class="brand" href="/">Topogram Todo</a>
    <nav>
      <a href="/tasks">Tasks</a>
      <a href="/tasks/new">Create Task</a>
    </nav>
  </header>

  <slot />
</div>
