export const ISSUES_WEB_REFERENCE = {
  brandName: "Topogram Issues",
  client: {
    primaryParam: "issue_id",
    functionNames: {
      list: "listIssues",
      get: "getIssue",
      create: "createIssue",
      update: "updateIssue",
      terminal: "closeIssue"
    },
    capabilityIds: {
      list: "cap_list_issues",
      get: "cap_get_issue",
      create: "cap_create_issue",
      update: "cap_update_issue",
      terminal: "cap_close_issue"
    }
  },
  nav: {
    browseLabel: "Issues",
    browseRoute: "/issues",
    createLabel: "Create Issue",
    createRoute: "/issues/new"
  },
  home: {
    demoPrimaryEnvVar: "PUBLIC_TOPOGRAM_DEMO_PRIMARY_ID",
    demoTaskLabel: "Open Demo Issue",
    heroDescriptionTemplate: "Generated from Topogram via the PROFILE profile and wired to the generated API client.",
    dynamicRouteText: "This screen uses a dynamic route.",
    noRouteText: "No direct route is exposed for this screen."
  },
  createPrimary: {
    defaultAssigneeEnvVar: "PUBLIC_TOPOGRAM_DEMO_USER_ID",
    defaultContainerEnvVar: "PUBLIC_TOPOGRAM_DEMO_CONTAINER_ID",
    helperText: "A board is required to create an issue. Assignee is optional.",
    projectPlaceholder: "Select a board",
    cancelLabel: "Cancel",
    submitLabel: "Create Issue"
  }
};
