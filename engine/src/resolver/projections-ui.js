import { blockEntries, getFieldValue } from "../validator.js";
import { normalizeSequence, tokenValue } from "./shared.js";

export function parseProjectionUiScreensBlock(statement, registry) {
  return blockEntries(getFieldValue(statement, "screens")).map((entry) => {
    const directives = {};

    for (let i = 2; i < entry.items.length; i += 2) {
      const key = tokenValue(entry.items[i]);
      const value = tokenValue(entry.items[i + 1]);
      if (key && value != null) {
        directives[key] = value;
      }
    }

    return {
      type: "ui_screen",
      id: tokenValue(entry.items[1]),
      kind: directives.kind || null,
      title: directives.title || null,
      load: directives.load ? { id: directives.load, kind: registry.get(directives.load)?.kind || null } : null,
      itemShape: directives.item_shape ? { id: directives.item_shape, kind: registry.get(directives.item_shape)?.kind || null } : null,
      viewShape: directives.view_shape ? { id: directives.view_shape, kind: registry.get(directives.view_shape)?.kind || null } : null,
      inputShape: directives.input_shape ? { id: directives.input_shape, kind: registry.get(directives.input_shape)?.kind || null } : null,
      submit: directives.submit ? { id: directives.submit, kind: registry.get(directives.submit)?.kind || null } : null,
      detailCapability: directives.detail_capability
        ? { id: directives.detail_capability, kind: registry.get(directives.detail_capability)?.kind || null }
        : null,
      primaryAction: directives.primary_action
        ? { id: directives.primary_action, kind: registry.get(directives.primary_action)?.kind || null }
        : null,
      secondaryAction: directives.secondary_action
        ? { id: directives.secondary_action, kind: registry.get(directives.secondary_action)?.kind || null }
        : null,
      destructiveAction: directives.destructive_action
        ? { id: directives.destructive_action, kind: registry.get(directives.destructive_action)?.kind || null }
        : null,
      terminalAction: directives.terminal_action
        ? { id: directives.terminal_action, kind: registry.get(directives.terminal_action)?.kind || null }
        : null,
      successNavigate: directives.success_navigate || null,
      successRefresh: directives.success_refresh || null,
      emptyTitle: directives.empty_title || null,
      emptyBody: directives.empty_body || null,
      loadingState: directives.loading_state || null,
      errorState: directives.error_state || null,
      unauthorizedState: directives.unauthorized_state || null,
      notFoundState: directives.not_found_state || null,
      successState: directives.success_state || null,
      raw: normalizeSequence(entry.items),
      loc: entry.loc
    };
  });
}

export function parseProjectionUiCollectionsBlock(statement) {
  return blockEntries(getFieldValue(statement, "collection_views")).map((entry) => {
    const operation = tokenValue(entry.items[2]);
    const primaryValue = tokenValue(entry.items[3]) || null;
    const secondaryValue = tokenValue(entry.items[4]) || null;

    return {
      type: "ui_collection_binding",
      screenId: tokenValue(entry.items[1]),
      operation,
      field: ["filter", "search", "sort", "group"].includes(operation) ? primaryValue : null,
      direction: operation === "sort" ? secondaryValue : null,
      value: primaryValue,
      extra: secondaryValue,
      raw: normalizeSequence(entry.items),
      loc: entry.loc
    };
  });
}

export function parseProjectionUiActionsBlock(statement, registry) {
  return blockEntries(getFieldValue(statement, "screen_actions")).map((entry) => ({
    type: "ui_action_binding",
    screenId: tokenValue(entry.items[1]),
    capability: tokenValue(entry.items[3])
      ? {
          id: tokenValue(entry.items[3]),
          kind: registry.get(tokenValue(entry.items[3]))?.kind || null
        }
      : null,
    prominence: tokenValue(entry.items[5]) || null,
    placement: tokenValue(entry.items[6]) === "placement" ? tokenValue(entry.items[7]) || null : null,
    raw: normalizeSequence(entry.items),
    loc: entry.loc
  }));
}

export function parseProjectionUiVisibilityBlock(statement, registry) {
  return blockEntries(getFieldValue(statement, "visibility_rules")).map((entry) => {
    const directives = {};
    for (let i = 5; i < entry.items.length; i += 2) {
      const key = tokenValue(entry.items[i]);
      const value = tokenValue(entry.items[i + 1]);
      if (key && value != null) {
        directives[key] = value;
      }
    }

    return {
      type: "visibility_rules_rule",
      capability: tokenValue(entry.items[1])
        ? {
            id: tokenValue(entry.items[1]),
            kind: registry.get(tokenValue(entry.items[1]))?.kind || null
          }
        : null,
      predicate: tokenValue(entry.items[3]) || null,
      value: tokenValue(entry.items[4]) || null,
      claimValue: directives.claim_value || null,
      raw: normalizeSequence(entry.items),
      loc: entry.loc
    };
  });
}

export function parseProjectionUiLookupsBlock(statement, registry) {
  return blockEntries(getFieldValue(statement, "field_lookups")).map((entry) => ({
    type: "ui_lookup_binding",
    screenId: tokenValue(entry.items[1]),
    field: tokenValue(entry.items[3]) || null,
    entity: tokenValue(entry.items[5])
      ? {
          id: tokenValue(entry.items[5]),
          kind: registry.get(tokenValue(entry.items[5]))?.kind || null
        }
      : null,
    labelField: tokenValue(entry.items[7]) || null,
    emptyLabel: tokenValue(entry.items[9]) || null,
    raw: normalizeSequence(entry.items),
    loc: entry.loc
  }));
}

export function parseProjectionUiRoutesBlock(statement) {
  return blockEntries(getFieldValue(statement, "screen_routes")).map((entry) => ({
    type: "ui_route",
    screenId: tokenValue(entry.items[1]),
    path: tokenValue(entry.items[3]) || null,
    raw: normalizeSequence(entry.items),
    loc: entry.loc
  }));
}

export function parseProjectionUiIosBlock(statement, registry) {
  return blockEntries(getFieldValue(statement, "ios_hints")).map((entry) => ({
    type: "ios_hint_binding",
    targetKind: tokenValue(entry.items[0]),
    targetId: tokenValue(entry.items[1]),
    capability:
      tokenValue(entry.items[0]) === "action" && tokenValue(entry.items[1])
        ? {
            id: tokenValue(entry.items[1]),
            kind: registry.get(tokenValue(entry.items[1]))?.kind || null
          }
        : null,
    directive: tokenValue(entry.items[2]) || null,
    value: tokenValue(entry.items[3]) || null,
    raw: normalizeSequence(entry.items),
    loc: entry.loc
  }));
}

export function parseProjectionUiWebBlock(statement, registry) {
  return blockEntries(getFieldValue(statement, "web_hints")).map((entry) => ({
    type: "web_hint_binding",
    targetKind: tokenValue(entry.items[0]),
    targetId: tokenValue(entry.items[1]),
    capability:
      tokenValue(entry.items[0]) === "action" && tokenValue(entry.items[1])
        ? {
            id: tokenValue(entry.items[1]),
            kind: registry.get(tokenValue(entry.items[1]))?.kind || null
          }
        : null,
    directive: tokenValue(entry.items[2]) || null,
    value: tokenValue(entry.items[3]) || null,
    raw: normalizeSequence(entry.items),
    loc: entry.loc
  }));
}

export function parseProjectionUiAppShellBlock(statement) {
  return blockEntries(getFieldValue(statement, "app_shell")).map((entry) => ({
    type: "app_shell_binding",
    key: tokenValue(entry.items[0]) || null,
    value: tokenValue(entry.items[1]) || null,
    raw: normalizeSequence(entry.items),
    loc: entry.loc
  }));
}

export function parseProjectionUiDesignBlock(statement) {
  return blockEntries(getFieldValue(statement, "design_tokens")).map((entry) => ({
    type: "design_tokens_token",
    key: tokenValue(entry.items[0]) || null,
    role: tokenValue(entry.items[1]) || null,
    value: tokenValue(entry.items[2]) || null,
    raw: normalizeSequence(entry.items),
    loc: entry.loc
  }));
}

export function parseProjectionUiNavigationBlock(statement) {
  return blockEntries(getFieldValue(statement, "navigation")).map((entry) => {
    const directives = {};
    for (let i = 2; i < entry.items.length; i += 2) {
      const key = tokenValue(entry.items[i]);
      const value = tokenValue(entry.items[i + 1]);
      if (key && value != null) {
        directives[key] = value;
      }
    }

    return {
      type: "navigation_binding",
      targetKind: tokenValue(entry.items[0]) || null,
      targetId: tokenValue(entry.items[1]) || null,
      directives,
      raw: normalizeSequence(entry.items),
      loc: entry.loc
    };
  });
}

export function parseProjectionUiScreenRegionsBlock(statement) {
  return blockEntries(getFieldValue(statement, "screen_regions")).map((entry) => {
    const directives = {};
    for (let i = 4; i < entry.items.length; i += 2) {
      const key = tokenValue(entry.items[i]);
      const value = tokenValue(entry.items[i + 1]);
      if (key && value != null) {
        directives[key] = value;
      }
    }

    return {
      type: "ui_screen_region_binding",
      screenId: tokenValue(entry.items[1]) || null,
      region: tokenValue(entry.items[3]) || null,
      pattern: directives.pattern || null,
      placement: directives.placement || null,
      title: directives.title || null,
      state: directives.state || null,
      variant: directives.variant || null,
      raw: normalizeSequence(entry.items),
      loc: entry.loc
    };
  });
}

export function parseProjectionWidgetBindingsBlock(statement, registry) {
  return blockEntries(getFieldValue(statement, "widget_bindings")).map((entry) => {
    const dataBindings = [];
    const eventBindings = [];

    for (let i = 6; i < entry.items.length;) {
      const directive = tokenValue(entry.items[i]);
      if (directive === "data") {
        const prop = tokenValue(entry.items[i + 1]);
        const sourceId = tokenValue(entry.items[i + 3]);
        dataBindings.push({
          prop,
          source: sourceId
            ? {
                id: sourceId,
                kind: registry.get(sourceId)?.kind || null
              }
            : null
        });
        i += 4;
        continue;
      }
      if (directive === "event") {
        const event = tokenValue(entry.items[i + 1]);
        const action = tokenValue(entry.items[i + 2]);
        const targetId = tokenValue(entry.items[i + 3]);
        eventBindings.push({
          event,
          action,
          target: targetId
            ? {
                id: targetId,
                kind: action === "navigate" ? "screen" : registry.get(targetId)?.kind || null
              }
            : null
        });
        i += 4;
        continue;
      }
      i += 1;
    }

    const widgetId = tokenValue(entry.items[5]);
    const widgetRef = widgetId
      ? {
          id: widgetId,
          kind: registry.get(widgetId)?.kind || null
        }
      : null;
    const binding = {
      type: "widget_binding",
      screenId: tokenValue(entry.items[1]) || null,
      region: tokenValue(entry.items[3]) || null,
      widget: widgetRef,
      dataBindings,
      eventBindings,
      raw: normalizeSequence(entry.items),
      loc: entry.loc
    };
    return binding;
  });
}
