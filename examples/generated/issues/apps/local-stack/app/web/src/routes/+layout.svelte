<script lang="ts">
  import "../app.css";
</script>

<div class="app-shell" data-shell="split_view" data-windowing="multi_window" data-navigation-patterns="command_palette segmented_control stack_navigation">
  <div class="app-workspace">
  <aside class="app-sidebar">
    <a class="brand" href="/">Topogram Issues</a>
    <nav class="app-nav-links">
      <a href="/issues">Issues</a>
    </nav>
    <button class="command-palette-button" type="button">Command Palette</button>
  </aside>
  <div class="app-main-shell">
    <header class="app-nav compact">
      <div class="brand-mark">Topogram Issues</div>
      <button class="command-palette-button" type="button">Command Palette</button>
    </header>

    <slot />
  </div>
</div>

  <footer class="app-footer">
    <span>Generated from Topogram</span>
  </footer>
</div>
