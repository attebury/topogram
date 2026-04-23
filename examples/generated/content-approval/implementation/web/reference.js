export const CONTENT_APPROVAL_WEB_REFERENCE = {
  brandName: "Topogram Content Approval",
  client: {
    primaryParam: "article_id",
    functionNames: {
      list: "listArticles",
      get: "getArticle",
      create: "createArticle",
      update: "updateArticle",
      terminal: "approveArticle"
    },
    capabilityIds: {
      list: "cap_list_articles",
      get: "cap_get_article",
      create: "cap_create_article",
      update: "cap_update_article",
      terminal: "cap_approve_article",
      requestRevision: "cap_request_article_revision",
      reject: "cap_reject_article"
    }
  },
  nav: {
    browseLabel: "Articles",
    browseRoute: "/articles",
    createLabel: "Create Article",
    createRoute: "/articles/new"
  },
  home: {
    demoPrimaryEnvVar: "PUBLIC_TOPOGRAM_DEMO_PRIMARY_ID",
    demoTaskLabel: "Open Demo Article",
    heroDescriptionTemplate: "Generated from Topogram via the PROFILE profile and wired to the generated API client.",
    dynamicRouteText: "This screen uses a dynamic route.",
    noRouteText: "No direct route is exposed for this screen."
  },
  createPrimary: {
    defaultAssigneeEnvVar: "PUBLIC_TOPOGRAM_DEMO_USER_ID",
    defaultContainerEnvVar: "PUBLIC_TOPOGRAM_DEMO_CONTAINER_ID",
    helperText: "A publication is required to create an article. Reviewer is optional until the article is submitted.",
    projectPlaceholder: "Select a publication",
    cancelLabel: "Cancel",
    submitLabel: "Create Article"
  }
};
