export const APP_BASIC_WEB_REFERENCE = {
  brandName: "Topogram Sample Workspace",
  client: {
    primaryParam: "item_id",
    functionNames: {
      list: "listItems",
      get: "getItem",
      create: "createItem",
      update: "updateItem",
      terminal: "completeItem"
    },
    capabilityIds: {
      list: "cap_list_items",
      get: "cap_get_item",
      create: "cap_create_item",
      update: "cap_update_item",
      terminal: "cap_complete_item"
    },
    extraFunctions: [
      { name: "deleteItem", capabilityId: "cap_delete_item", primaryParam: "item_id" },
      { name: "exportItems", capabilityId: "cap_export_items" },
      { name: "getItemExportJob", capabilityId: "cap_get_item_export_job", primaryParam: "job_id" }
    ]
  },
  nav: {
    browseLabel: "Items",
    browseRoute: "/items",
    createLabel: "Create Item",
    createRoute: "/items/new",
    links: [
      { label: "Items", route: "/items" },
      { label: "Collections", route: "/collections" },
      { label: "Members", route: "/members" }
    ]
  },
  home: {
    demoPrimaryEnvVar: "PUBLIC_TOPOGRAM_DEMO_PRIMARY_ID",
    demoItemLabel: "Open Demo Item",
    heroDescriptionTemplate: "Generated from Topogram via the PROFILE profile and wired to a multi-resource workspace for items, collections, and members.",
    dynamicRouteText: "This screen uses a dynamic route.",
    noRouteText: "No direct route is exposed for this screen."
  },
  createPrimary: {
    defaultAssigneeEnvVar: "PUBLIC_TOPOGRAM_DEMO_USER_ID",
    defaultContainerEnvVar: "PUBLIC_TOPOGRAM_DEMO_CONTAINER_ID",
    helperText: "A collection is required to create a item. Owner is optional.",
    collectionPlaceholder: "Select a collection",
    cancelLabel: "Cancel",
    submitLabel: "Create Item"
  }
};
