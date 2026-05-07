export const APP_BASIC_RUNTIME_CHECKS = {
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
        id: "web_items_page_ready",
        kind: "web_contract",
        path: "/items",
        expectStatus: 200,
        expectText: "Items",
        mandatory: true,
        mutating: false
      },
      {
        id: "web_collections_page_ready",
        kind: "web_contract",
        path: "/collections",
        expectStatus: 200,
        expectText: "Collections",
        mandatory: true,
        mutating: false
      },
      {
        id: "web_members_page_ready",
        kind: "web_contract",
        path: "/members",
        expectStatus: 200,
        expectText: "Members",
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
        id: "api_seed_item_ready",
        kind: "api_contract",
        capabilityId: "cap_get_item",
        pathParams: {
          item_id: "$env:TOPOGRAM_DEMO_PRIMARY_ID"
        },
        expectShape: "item_detail",
        mandatory: true,
        mutating: false
      },
      {
        id: "web_item_detail_owner_edit_visible",
        kind: "web_contract",
        path: "/items/$env:TOPOGRAM_DEMO_PRIMARY_ID",
        expectStatus: 200,
        expectText: "Edit Item",
        mandatory: true,
        mutating: false
      },
      {
        id: "web_item_detail_non_owner_edit_hidden",
        kind: "web_contract",
        path: "/items/$env:TOPOGRAM_DEMO_PRIMARY_ID?topogram_auth_member_id=99999999-9999-4999-8999-999999999999",
        expectStatus: 200,
        expectText: "Back to Items",
        expectNotText: "Edit Item",
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
      { id: "create_item", kind: "api_contract", capabilityId: "cap_create_item", mutating: true, mandatory: true },
      { id: "get_created_item", kind: "api_contract", capabilityId: "cap_get_item", mutating: false, mandatory: true },
      { id: "list_items", kind: "api_contract", capabilityId: "cap_list_items", mutating: false, mandatory: true },
      { id: "export_items", kind: "api_contract", capabilityId: "cap_export_items", mutating: true, mandatory: true },
      { id: "get_item_export_job", kind: "api_contract", capabilityId: "cap_get_item_export_job", mutating: false, mandatory: true },
      { id: "download_item_export", kind: "api_contract", capabilityId: "cap_download_item_export", mutating: false, mandatory: true },
      { id: "collection_lookup_ready", kind: "lookup_contract", lookupKey: "collection", mandatory: true, mutating: false },
      { id: "member_lookup_ready", kind: "lookup_contract", lookupKey: "member", mandatory: true, mutating: false },
      { id: "update_without_precondition", kind: "api_negative", capabilityId: "cap_update_item", expectStatusFrom: "precondition", expectErrorCodeFrom: "precondition", mutating: false, mandatory: true },
      { id: "update_with_stale_precondition", kind: "api_negative", capabilityId: "cap_update_item", expectStatus: 412, expectErrorCode: "stale_precondition", stalePrecondition: true, mutating: false, mandatory: true },
      { id: "update_item", kind: "api_contract", capabilityId: "cap_update_item", mutating: true, mandatory: true },
      { id: "complete_without_precondition", kind: "api_negative", capabilityId: "cap_complete_item", expectStatusFrom: "precondition", expectErrorCodeFrom: "precondition", mutating: false, mandatory: true },
      { id: "complete_item", kind: "api_contract", capabilityId: "cap_complete_item", mutating: true, mandatory: true },
      { id: "delete_without_precondition", kind: "api_negative", capabilityId: "cap_delete_item", expectStatusFrom: "precondition", expectErrorCodeFrom: "precondition", mutating: false, mandatory: true },
      { id: "delete_item", kind: "api_contract", capabilityId: "cap_delete_item", mutating: true, mandatory: true },
      { id: "invalid_create_returns_4xx", kind: "api_negative", capabilityId: "cap_create_item", expectStatusClass: 4, expectErrorCode: "cap_create_item_invalid_request", mutating: false, mandatory: true },
      { id: "get_unknown_item_not_found", kind: "api_negative", capabilityId: "cap_get_item", expectStatus: 404, expectErrorCode: "cap_get_item_not_found", mutating: false, mandatory: true }
    ]
  },
  smokeChecks: [
    { id: "web_items_page", type: "web_get", path: "/items", expectStatus: 200, expectText: "Items" },
    { id: "create_item", type: "api_post", path: "/items", expectStatus: 201, capabilityId: "cap_create_item" },
    { id: "get_item", type: "api_get", path: "/items/:id", expectStatus: 200, capabilityId: "cap_get_item" },
    { id: "list_items", type: "api_get", path: "/items", expectStatus: 200, capabilityId: "cap_list_items" }
  ]
};
