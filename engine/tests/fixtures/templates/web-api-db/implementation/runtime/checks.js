export const HELLO_RUNTIME_CHECKS = {
  environmentStage: {
    id: "environment",
    name: "Environment Readiness",
    failFast: true,
    checks: [
      {
        id: "required_env",
        kind: "env_required",
        mandatory: true,
        mutating: false
      },
      {
        id: "web_home_ready",
        kind: "web_contract",
        path: "/",
        expectStatus: 200,
        expectText: "Topogram Starter",
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
        id: "api_seed_greeting_ready",
        kind: "api_contract",
        capabilityId: "cap_get_greeting",
        pathParams: {
          greeting_id: "$env:TOPOGRAM_DEMO_PRIMARY_ID"
        },
        mandatory: true,
        mutating: false
      }
    ]
  },
  apiStage: {
    id: "api",
    name: "API Contract Checks",
    checks: [
      { id: "create_greeting", kind: "api_contract", capabilityId: "cap_create_greeting", mutating: true, mandatory: true },
      { id: "get_created_greeting", kind: "api_contract", capabilityId: "cap_get_greeting", mutating: false, mandatory: true },
      { id: "list_greetings", kind: "api_contract", capabilityId: "cap_list_greetings", mutating: false, mandatory: true },
      { id: "update_greeting", kind: "api_contract", capabilityId: "cap_update_greeting", mutating: true, mandatory: true },
      { id: "invalid_create_returns_4xx", kind: "api_negative", capabilityId: "cap_create_greeting", expectStatusClass: 4, expectErrorCode: "cap_create_greeting_invalid_request", mutating: false, mandatory: true },
      { id: "get_unknown_greeting_not_found", kind: "api_negative", capabilityId: "cap_get_greeting", expectStatus: 404, expectErrorCode: "cap_get_greeting_not_found", mutating: false, mandatory: true }
    ]
  },
  smokeChecks: [
    { id: "web_home_page", type: "web_get", path: "/", expectStatus: 200, expectText: "Topogram Starter" },
    { id: "create_greeting", type: "api_post", path: "/greetings", expectStatus: 201, capabilityId: "cap_create_greeting" },
    { id: "get_greeting", type: "api_get", path: "/greetings/:id", expectStatus: 200, capabilityId: "cap_get_greeting" },
    { id: "list_greetings", type: "api_get", path: "/greetings", expectStatus: 200, capabilityId: "cap_list_greetings" }
  ]
};
