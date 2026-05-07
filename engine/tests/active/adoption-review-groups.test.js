import test from "node:test";
import assert from "node:assert/strict";

import {
  buildProjectionReviewGroups,
  buildUiReviewGroups
} from "../../src/adoption/review-groups.js";

test("adoption review groups use projection_type terminology", () => {
  const items = [
    {
      bundle: "issue",
      item: "widget_issue_results",
      kind: "widget",
      status: "needs_projection_review",
      blocking_dependencies: [
        {
          type: "projection_review",
          id: "projection_review:proj_web",
          projection_id: "proj_web",
          kind: "modified",
          projection_type: "web_surface",
          reason: "Generated surface impact must be reviewed"
        },
        {
          type: "ui_review",
          id: "ui_review:proj_ui_contract",
          projection_id: "proj_ui_contract",
          kind: "modified",
          projection_type: "ui_contract",
          reason: "Shared UI contract impact must be reviewed"
        }
      ]
    }
  ];

  const projectionGroups = buildProjectionReviewGroups(items);
  assert.equal(projectionGroups[0].projection_type, "web_surface");
  assert.equal(Object.hasOwn(projectionGroups[0], "platform"), false);

  const uiGroups = buildUiReviewGroups(items);
  assert.equal(uiGroups[0].projection_type, "ui_contract");
  assert.equal(Object.hasOwn(uiGroups[0], "platform"), false);
});
