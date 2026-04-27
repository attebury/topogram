<script lang="ts">
  import "../app.css";
</script>

<div class="app-shell" data-shell="sidebar" data-windowing="single_window" data-navigation-patterns="navigation_rail tabs">
  <header class="app-nav">
  <a class="brand" href="/">Topogram Content Approval</a>
  <nav class="app-nav-links">
      <a href="/articles">Articles</a>
      <a href="/settings">Settings</a>
  </nav>
</header>

<slot />

  <footer class="app-footer">
    <span>Generated from Topogram</span>
  </footer>
</div>
