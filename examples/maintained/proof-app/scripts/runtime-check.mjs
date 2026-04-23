import {
  assertEmittedArtifactAlignment,
  assertMaintainedAppProofScenarios
} from "./proof-scenarios.mjs";

const journeyContext = assertEmittedArtifactAlignment();
assertMaintainedAppProofScenarios(journeyContext);

console.log("runtime-check ok");
