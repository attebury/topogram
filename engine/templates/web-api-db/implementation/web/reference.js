export const HELLO_WEB_REFERENCE = {
  brandName: "Topogram Starter",
  client: {
    primaryParam: "greeting_id",
    functionNames: {
      list: "listGreetings",
      get: "getGreeting",
      create: "createGreeting",
      update: "updateGreeting",
      terminal: "reloadGreeting"
    },
    capabilityIds: {
      list: "cap_list_greetings",
      get: "cap_get_greeting",
      create: "cap_create_greeting",
      update: "cap_update_greeting",
      terminal: "cap_get_greeting"
    },
    extraFunctions: []
  },
  nav: {
    browseLabel: "Starter",
    browseRoute: "/",
    createLabel: "API Contract",
    createRoute: "/",
    links: [
      { label: "Home", route: "/" }
    ]
  },
  home: {
    demoPrimaryEnvVar: "PUBLIC_TOPOGRAM_DEMO_PRIMARY_ID",
    demoTaskLabel: "Seeded Greeting ID",
    heroDescriptionTemplate: "Generated from Topogram via the PROFILE profile and wired to a neutral API, web surface, and database.",
    dynamicRouteText: "This screen uses a dynamic route.",
    noRouteText: "No direct route is exposed for this screen."
  },
  createPrimary: {
    defaultAssigneeEnvVar: "PUBLIC_TOPOGRAM_DEMO_USER_ID",
    defaultContainerEnvVar: "PUBLIC_TOPOGRAM_DEMO_MESSAGE",
    helperText: "Create a greeting through the generated API.",
    projectPlaceholder: "Greeting message",
    cancelLabel: "Cancel",
    submitLabel: "Create Greeting"
  }
};
