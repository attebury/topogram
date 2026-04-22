# Backend Reference Seam

This proof note anchors the maintained backend reference output for the `content-approval` example.

It exists so multi-output maintained-boundary and seam-check surfaces can treat the implementation-side backend reference as a governed output alongside the maintained runtime.

The important seam here is the example backend reference integration:

- maintained file: `examples/content-approval/implementation/backend/reference.js`
- emitted dependencies: `proj_api`, `proj_db`
- expected posture: accepted change, contract-bound
