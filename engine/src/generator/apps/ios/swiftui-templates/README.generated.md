# Todo SwiftUI (generated)

Apple SwiftUI client generated from the same **`buildWebRealization`** routed UI contract as the web stacks. Prefer the **`proj_ui_native__ios`** projection when present; otherwise the generator falls back to a **`proj_ui_web__*`** projection (often **`proj_ui_web__sveltekit`**).

## Bundle inputs

- **`Resources/ui-web-contract.json`** — same shape as `apps/web/src/lib/topogram/ui-web-contract.json`
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
node ./src/cli.js ../demos/generated/todo-demo-app/topogram --generate swiftui-app --projection proj_ui_native__ios --write --out-dir ../demos/generated/todo-demo-app/app/ios-swiftui
```
