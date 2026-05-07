<script lang="ts">
  import "../app.css";
</script>

<div class="app-shell" data-shell="bottom_tabs" data-windowing="single_window" data-navigation-patterns="bottom_tabs stack_navigation">
  <header class="app-nav">
  <a class="brand" href="/">Topogram Sample Workspace</a>
</header>

<slot />

<nav class="app-tabbar">
      <a href="/items">Items</a>
      <a href="/items/board">Board</a>
      <a href="/items/calendar">Calendar</a>
      <a href="/collections">Collections</a>
      <a href="/members">Members</a>
</nav>

  <footer class="app-footer">
    <span>Generated from Topogram</span>
  </footer>
</div>
