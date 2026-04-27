<script lang="ts">
  import "../app.css";
</script>

<div class="app-shell" data-shell="bottom_tabs" data-windowing="single_window" data-navigation-patterns="bottom_tabs stack_navigation">
  <header class="app-nav">
  <a class="brand" href="/">Topogram Todo</a>
</header>

<slot />

<nav class="app-tabbar">
      <a href="/tasks">Tasks</a>
      <a href="/tasks/board">Board</a>
      <a href="/tasks/calendar">Calendar</a>
      <a href="/projects">Projects</a>
      <a href="/users">Users</a>
</nav>

  <footer class="app-footer">
    <span>Generated from Topogram</span>
  </footer>
</div>
