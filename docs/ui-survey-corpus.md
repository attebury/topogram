# UI Survey Corpus

The Topogram UI DSL survey corpus lives under [trials/ui-survey](/Users/attebury/Documents/topogram/trials/ui-survey/README.md).

## Current Survey Corpus

- Project management: `plane`, `openproject`, `leantime`, `planka`, `wekan`
- CRM / ERP: `twenty`, `espocrm`, `erpnext`
- Support: `chatwoot`, `osticket`, `uvdesk`, `helpy`
- Booking: `cal-com`, `librebooking`
- Internal tools: `appsmith`, `nocodb`
- Commerce / workflow: `saleor-dashboard`, `documenso`
- Community / collaboration: `discourse`, `mattermost`, `humhub`
- LMS: `moodle`
- Android: `nowinandroid`, `home-assistant-android`, `fenix`, `bitwarden-android`, `nextcloud-android`, `thunderbird-android`, `tasks-org`, `tusky`, `newpipe`, `etar-calendar`, `osmand`, `commons-app`
- iOS: `home-assistant-ios`, `wordpress-ios`, `nextcloud-ios`, `mastodon-ios`, `altstore`, `netnewswire`, `keepassium`, `firefox-ios`, `icecubes`, `loopkit`, `element-x-ios`, `swiftfin`
- Desktop: `github-desktop`, `mattermost-desktop`, `standardnotes`, `beekeeper-studio`, `joplin`, `ferdium`, `chatgpt-tauri`, `codeedit`, `files-app`, `lapce`, `rustdesk`, `iina`

## Artifacts

- [manifest.json](/Users/attebury/Documents/topogram/trials/ui-survey/manifest.json): canonical repo inventory
- [concept-taxonomy.json](/Users/attebury/Documents/topogram/trials/ui-survey/concept-taxonomy.json): normalized UI concepts
- `analysis/normalized-findings.json`: generated survey findings
- `analysis/summary.md`: generated survey summary
- `analysis/master-report.md`: combined cross-platform survey report
- `analysis/coverage-report.md`: generated Topogram coverage matrix for surveyed UI patterns
- `analysis/clone-status.json`: clone/deferred status for shallow survey pulls

## Workflow

Run:

```bash
node engine/scripts/analyze-ui-survey.mjs
```

To populate the Android, iOS, and desktop survey buckets with shallow clones first:

```bash
node engine/scripts/clone-ui-survey.mjs --platforms=android,ios,desktop
```

The clone helper uses `git clone --depth 1 --filter=blob:none` when possible, falls back to plain shallow clones when needed, removes `.git` metadata after checkout, and records deferred repos in `analysis/clone-status.json`.

The analyzer scans the local survey corpus and produces normalized findings for shell shape, navigation, runtime family, and recurring UI features across web, Android, iOS, and desktop apps. Those findings inform the app-shell, navigation, state, region, collection-presentation, and semantic-pattern layers in the Topogram UI DSL.

Notable normalization rule:
- `table` and `data_grid` are counted separately. Use `table` for straightforward tabular presentations, and `data_grid` for spreadsheet-like or highly interactive tabular UIs.
- Mobile- and desktop-native interactions such as `bottom_tabs`, `stack_navigation`, `split_view`, `fab`, `sheet`, `pull_to_refresh`, `command_palette`, `inspector_pane`, and `menu_bar` are normalized into shared semantic buckets when possible.
