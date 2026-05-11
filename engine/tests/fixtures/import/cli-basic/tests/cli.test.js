import assert from "node:assert/strict";

const noisyHelpFixture = `
Usage: fakecli destroy --force --json
Usage: fakecli fixtures seed --json
`;

assert.match(noisyHelpFixture, /fakecli destroy/);
