# Todo SwiftUI (generated)

Apple SwiftUI client generated from the same **`buildWebRealization`** routed UI contract as the web stacks. Prefer the **`proj_ios_surface__swiftui`** projection when present; otherwise the generator falls back to a **`proj_web_surface__*`** projection (often **`proj_web_surface__sveltekit`**).

## Bundle inputs

- **`Resources/ui-surface-contract.json`** — same shape as `apps/web/src/lib/topogram/ui-surface-contract.json`
- **`Resources/api-contracts.json`** — same shape as `apps/web/src/lib/topogram/api-contracts.json`

## Run

Open **`Package.swift`** in Xcode 15+ and run the **`TodoSwiftUIApp`** scheme on an iOS Simulator.

Configure the API base URL and demo auth token via scheme environment variables (mirror web):

- `PUBLIC_TOPOGRAM_API_BASE_URL` (default `http://localhost:3000`)
- `PUBLIC_TOPOGRAM_DEMO_AUTH_TOKEN`
- Optional JWT / permission env vars matching web `visibility.ts` (`PUBLIC_TOPOGRAM_AUTH_*`).

## Regenerate

From `engine/`:

```bash
topogram ./topogram --generate swiftui-app --projection proj_ios_surface__swiftui --write --out-dir ./app/ios-swiftui
```
