export const CONTENT_APPROVAL_RUNTIME_CHECKS = {
  environmentStage: {
    id: "environment",
    name: "Environment Readiness",
    failFast: true,
    checks: [
      { id: "required_env", kind: "env_required", mandatory: true, mutating: false },
      {
        id: "web_articles_page_ready",
        kind: "web_contract",
        path: "/articles",
        expectStatus: 200,
        expectText: "Articles",
        mandatory: true,
        mutating: false
      },
      {
        id: "web_article_detail_reviewer_actions_visible",
        kind: "web_browser_contract",
        path: "/articles/$env:TOPOGRAM_DEMO_PRIMARY_ID",
        expectText: "Approve Article",
        mandatory: true,
        mutating: false
      },
      {
        id: "web_article_detail_reviewer_actions_hidden",
        kind: "web_browser_contract",
        path: "/articles/$env:TOPOGRAM_DEMO_PRIMARY_ID?topogram_auth_claims=%7B%22reviewer%22%3Afalse%7D",
        expectNotText: "Approve Article",
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
        id: "api_seed_article_ready",
        kind: "api_contract",
        capabilityId: "cap_get_article",
        pathParams: {
          article_id: "$env:TOPOGRAM_DEMO_PRIMARY_ID"
        },
        expectShape: "article_detail",
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
      { id: "create_article", kind: "api_contract", capabilityId: "cap_create_article", mutating: true, mandatory: true },
      { id: "get_created_article", kind: "api_contract", capabilityId: "cap_get_article", mutating: false, mandatory: true },
      { id: "list_articles", kind: "api_contract", capabilityId: "cap_list_articles", mutating: false, mandatory: true },
      { id: "publication_lookup_ready", kind: "lookup_contract", lookupKey: "publication", mandatory: true, mutating: false },
      { id: "user_lookup_ready", kind: "lookup_contract", lookupKey: "user", mandatory: true, mutating: false },
      { id: "update_without_precondition", kind: "api_negative", capabilityId: "cap_update_article", expectStatusFrom: "precondition", expectErrorCodeFrom: "precondition", mandatory: true, mutating: false },
      { id: "update_with_stale_precondition", kind: "api_negative", capabilityId: "cap_update_article", expectStatus: 412, expectErrorCode: "stale_precondition", stalePrecondition: true, mandatory: true, mutating: false },
      { id: "update_article", kind: "api_contract", capabilityId: "cap_update_article", mutating: true, mandatory: true },
      { id: "request_revision_without_precondition", kind: "api_negative", capabilityId: "cap_request_article_revision", expectStatusFrom: "precondition", expectErrorCodeFrom: "precondition", mandatory: true, mutating: false },
      { id: "request_article_revision", kind: "api_contract", capabilityId: "cap_request_article_revision", mutating: true, mandatory: true },
      { id: "resubmit_article", kind: "api_contract", capabilityId: "cap_update_article", mutating: true, mandatory: true },
      { id: "approve_without_precondition", kind: "api_negative", capabilityId: "cap_approve_article", expectStatusFrom: "precondition", expectErrorCodeFrom: "precondition", mandatory: true, mutating: false },
      { id: "approve_without_reviewer_claim", kind: "api_negative", capabilityId: "cap_approve_article", expectStatus: 403, expectErrorCode: "forbidden", mandatory: true, mutating: false },
      { id: "approve_article", kind: "api_contract", capabilityId: "cap_approve_article", mutating: true, mandatory: true },
      { id: "reject_without_precondition", kind: "api_negative", capabilityId: "cap_reject_article", expectStatusFrom: "precondition", expectErrorCodeFrom: "precondition", mandatory: true, mutating: false },
      { id: "reject_article", kind: "api_contract", capabilityId: "cap_reject_article", mutating: true, mandatory: true },
      { id: "invalid_create_returns_4xx", kind: "api_negative", capabilityId: "cap_create_article", expectStatusClass: 4, expectErrorCode: "cap_create_article_invalid_request", mandatory: true, mutating: false },
      { id: "get_unknown_article_not_found", kind: "api_negative", capabilityId: "cap_get_article", expectStatus: 404, expectErrorCode: "cap_get_article_not_found", mandatory: true, mutating: false }
    ]
  },
  smokeChecks: [
    { id: "web_articles_page", type: "web_get", path: "/articles", expectStatus: 200, expectText: "Articles" },
    { id: "create_article", type: "api_post", path: "/articles", expectStatus: 201, capabilityId: "cap_create_article" },
    { id: "get_article", type: "api_get", path: "/articles/:id", expectStatus: 200, capabilityId: "cap_get_article" },
    { id: "list_articles", type: "api_get", path: "/articles", expectStatus: 200, capabilityId: "cap_list_articles" }
  ]
};
