# SDLC

Core SDLC workflow moved to [SDLC](./concepts/sdlc.md).

## Command-Owned State

Declarative `.tg` source can be edited directly. Status/history/provenance
state should move through commands so drift is detectable.

| State | Command path |
| --- | --- |
| `topo/sdlc/.topogram-sdlc-history.json` | `topogram sdlc transition` and `topogram sdlc plan step ... --write` |
| `topo/sdlc/_archive/*.jsonl` | `topogram sdlc archive`, `topogram sdlc unarchive`, and `topogram sdlc compact` |
| `.topogram-template-trust.json` | `topogram trust status`, `topogram trust diff`, and `topogram trust template` |
| `.topogram-template-files.json` | `topogram trust template` and reviewed `topogram template update ...` commands |
| `.topogram-source.json` | `topogram catalog copy` and `topogram source status` |
| Import provenance and adoption receipts | `topogram import status` and `topogram import history --verify` |
| `app/.topogram-generated.json` | `topogram generate` |
| Written emitted artifacts | `topogram emit --write` |
| Release status reports and rollout evidence | `topogram release status` and `topogram release roll-consumers` |
