# Brownfield Trial: Firefox Focus UIKit

## Repo

- Trial repo: `/Users/attebury/Documents/topogram/trials/ui-survey/ios/firefox-ios/focus-ios`
- Source: `mozilla-mobile/firefox-ios` (`focus-ios` target)

## What This Trial Proved

This trial confirmed that Topogram can recover a credible controller-based iOS UI surface from a real UIKit app, not just a SwiftUI-first codebase.

The proof is intentionally UI-centric:

- no DB extractor is needed for this repo
- no API extractor is needed for this milestone
- the goal is recovering controller screens, navigation structure, and promotable UI review docs from UIKit

## Import Coverage

Current UIKit support in Topogram covers:

- `ui/uikit`
  - `UIViewController`
  - `UITableViewController`
  - `UICollectionViewController`
  - screen discovery from controller classes
  - route-like screen ids/paths
  - navigation evidence from `pushViewController`, `present`, and `show`

This now complements the earlier SwiftUI-first iOS proof.

## Imported Domain Surface

Recovered meaningful UIKit bundles include:

- `surface-browser`
- `surface-settings`
- `surface-onboarding`

The strongest bundles are:

- `surface-browser`
  - `BrowserViewController`
  - `HomeViewController`
- `surface-settings`
  - `SettingsViewController`
  - `SettingsContentViewController`
  - `ThemeViewController`
  - `TrackingProtectionViewController`
  - `AboutViewController`
  - related settings/detail controllers

## Canonical Outputs

Canonical outputs now exist under:

- `/Users/attebury/Documents/topogram/trials/ui-survey/ios/firefox-ios/focus-ios/topogram/docs/reports`

Promoted UIKit review docs include:

- `ui-browser.md`
- `ui-home.md`
- `ui-onboarding.md`
- `ui-tooltip.md`
- `ui-setting.md`
- `ui-settings_content.md`
- `ui-theme.md`
- `ui-tracking_protection.md`
- `ui-about.md`
- and related settings-surface docs

Representative files:

- `/Users/attebury/Documents/topogram/trials/ui-survey/ios/firefox-ios/focus-ios/topogram/docs/reports/ui-browser.md`
- `/Users/attebury/Documents/topogram/trials/ui-survey/ios/firefox-ios/focus-ios/topogram/docs/reports/ui-home.md`
- `/Users/attebury/Documents/topogram/trials/ui-survey/ios/firefox-ios/focus-ios/topogram/docs/reports/ui-setting.md`
- `/Users/attebury/Documents/topogram/trials/ui-survey/ios/firefox-ios/focus-ios/topogram/docs/reports/ui-theme.md`

## Current Queue State

The current saved queue is here:

- `/Users/attebury/Documents/topogram/trials/ui-survey/ios/firefox-ios/focus-ios/topogram/candidates/reconcile/adoption-status.md`

Current state:

- `surface-browser` is promoted
- `surface-settings` is promoted
- `surface-onboarding` is promoted
- the remaining queue is mostly smaller single-screen surfaces rather than a major missing UIKit bundle
- no review-group blockers are involved yet, because this is UI-report promotion rather than workflow adoption

## Why This Is Valuable

This gives Topogram a real UIKit proof alongside SwiftUI:

- SwiftUI proof: semantic import from SwiftUI + SwiftData + repository networking
- UIKit proof: controller-based screen and navigation recovery from a large production UIKit app

That combination is a much stronger iOS story than SwiftUI alone.

At this point, UIKit is confirmed enough to move on:

- the core browser surface is promoted
- the largest settings cluster is promoted
- the main onboarding surface is promoted
- the remaining queue is refinement work, not a proof blocker

## Deferred For UIKit v1

- storyboard/xib interpretation beyond basic project presence
- stronger flow grouping across all onboarding/settings variants
- deeper action semantics from selectors and delegate methods
- capability inference from UIKit events into backend semantics
