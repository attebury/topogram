export const ISSUES_RUNTIME_CHECKS = {
  environmentStage: {
    id: "environment",
    name: "Environment Readiness",
    failFast: true,
    checks: [
      { id: "required_env", kind: "env_required", mandatory: true, mutating: false },
      {
        id: "web_issues_page_ready",
        kind: "web_contract",
        path: "/issues",
        expectStatus: 200,
        expectText: "Issues",
        mandatory: true,
        mutating: false
      },
      {
        id: "api_health_ready",
        kind: "api_health",
        path: "/health",
        expectStatus: 200,
        expectOk: true,
        mandatory: true,
        mutating: false
      },
      {
        id: "api_ready",
        kind: "api_ready",
        path: "/ready",
        expectStatus: 200,
        expectReady: true,
        mandatory: true,
        mutating: false
      },
      {
        id: "api_seed_issue_ready",
        kind: "api_contract",
        capabilityId: "cap_get_issue",
        pathParams: {
          issue_id: "$env:TOPOGRAM_DEMO_PRIMARY_ID"
        },
        expectShape: "issue_detail",
        mandatory: true,
        mutating: false
      },
      {
        id: "web_issue_detail_owner_edit_visible",
        kind: "web_browser_contract",
        path: "/issues/$env:TOPOGRAM_DEMO_PRIMARY_ID",
        expectText: "Edit Issue",
        mandatory: true,
        mutating: false
      },
      {
        id: "web_issue_detail_non_owner_edit_hidden",
        kind: "web_browser_contract",
        path: "/issues/$env:TOPOGRAM_DEMO_PRIMARY_ID?topogram_auth_user_id=$env:TOPOGRAM_FORBIDDEN_USER_ID",
        expectText: "Back to Issues",
        expectNotText: "Edit Issue",
        mandatory: true,
        mutating: false
      }
    ]
  },
  apiStage: {
    id: "api",
    name: "API Runtime Flows",
    failFast: false,
    checks: [
      { id: "create_issue", kind: "api_contract", capabilityId: "cap_create_issue", mutating: true, mandatory: true },
      { id: "list_issues_unauthorized", kind: "api_negative", capabilityId: "cap_list_issues", expectStatus: 401, expectErrorCode: "missing_bearer_token", mandatory: true, mutating: false },
      { id: "list_issues_invalid_signature", kind: "api_negative", capabilityId: "cap_list_issues", expectStatus: 401, expectErrorCode: "invalid_bearer_signature", mandatory: true, mutating: false },
      { id: "list_issues_expired_token", kind: "api_negative", capabilityId: "cap_list_issues", expectStatus: 401, expectErrorCode: "expired_bearer_token", mandatory: true, mutating: false },
      { id: "list_issues_invalid_issuer", kind: "api_negative", capabilityId: "cap_list_issues", expectStatus: 401, expectErrorCode: "invalid_bearer_issuer", mandatory: true, mutating: false },
      { id: "list_issues_invalid_audience", kind: "api_negative", capabilityId: "cap_list_issues", expectStatus: 401, expectErrorCode: "invalid_bearer_audience", mandatory: true, mutating: false },
      { id: "get_forbidden_issue", kind: "api_negative", capabilityId: "cap_get_issue", expectStatus: 403, expectErrorCode: "forbidden", mandatory: true, mutating: false },
      { id: "get_created_issue", kind: "api_contract", capabilityId: "cap_get_issue", mutating: false, mandatory: true },
      { id: "list_issues", kind: "api_contract", capabilityId: "cap_list_issues", mutating: false, mandatory: true },
      { id: "board_lookup_ready", kind: "lookup_contract", lookupKey: "board", mandatory: true, mutating: false },
      { id: "user_lookup_ready", kind: "lookup_contract", lookupKey: "user", mandatory: true, mutating: false },
      { id: "update_without_precondition", kind: "api_negative", capabilityId: "cap_update_issue", expectStatusFrom: "precondition", expectErrorCodeFrom: "precondition", mandatory: true, mutating: false },
      { id: "update_with_stale_precondition", kind: "api_negative", capabilityId: "cap_update_issue", expectStatus: 412, expectErrorCode: "stale_precondition", stalePrecondition: true, mandatory: true, mutating: false },
      { id: "update_issue", kind: "api_contract", capabilityId: "cap_update_issue", mutating: true, mandatory: true },
      { id: "close_without_precondition", kind: "api_negative", capabilityId: "cap_close_issue", expectStatusFrom: "precondition", expectErrorCodeFrom: "precondition", mandatory: true, mutating: false },
      { id: "close_issue", kind: "api_contract", capabilityId: "cap_close_issue", mutating: true, mandatory: true },
      { id: "invalid_create_returns_4xx", kind: "api_negative", capabilityId: "cap_create_issue", expectStatusClass: 4, expectErrorCode: "cap_create_issue_invalid_request", mandatory: true, mutating: false },
      { id: "get_unknown_issue_not_found", kind: "api_negative", capabilityId: "cap_get_issue", expectStatus: 404, expectErrorCode: "cap_get_issue_not_found", mandatory: true, mutating: false }
    ]
  },
  smokeChecks: [
    { id: "web_issues_page", type: "web_get", path: "/issues", expectStatus: 200, expectText: "Issues" },
    { id: "create_issue", type: "api_post", path: "/issues", expectStatus: 201, capabilityId: "cap_create_issue" },
    { id: "get_issue", type: "api_get", path: "/issues/:id", expectStatus: 200, capabilityId: "cap_get_issue" },
    { id: "list_issues", type: "api_get", path: "/issues", expectStatus: 200, capabilityId: "cap_list_issues" }
  ]
};
