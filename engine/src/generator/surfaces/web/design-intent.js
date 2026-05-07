// @ts-check

const DEFAULT_DESIGN_INTENT = Object.freeze({
  density: "comfortable",
  tone: "neutral",
  radiusScale: "medium",
  colorRoles: Object.freeze({
    primary: "accent"
  }),
  typographyRoles: Object.freeze({
    body: "readable",
    heading: "prominent"
  }),
  actionRoles: Object.freeze({
    primary: "prominent"
  }),
  accessibility: Object.freeze({
    contrast: "aa",
    focus: "visible"
  })
});

const DENSITY_VALUES = {
  compact: {
    spaceUnit: "0.75rem",
    pagePadding: "1.5rem 1rem 3rem",
    controlPadding: "0.55rem 0.75rem"
  },
  comfortable: {
    spaceUnit: "1rem",
    pagePadding: "2rem 1.25rem 4rem",
    controlPadding: "0.7rem 1rem"
  },
  spacious: {
    spaceUnit: "1.25rem",
    pagePadding: "2.5rem 1.5rem 5rem",
    controlPadding: "0.85rem 1.15rem"
  }
};

const RADIUS_VALUES = {
  none: {
    card: "0",
    control: "0",
    pill: "0"
  },
  small: {
    card: "8px",
    control: "8px",
    pill: "999px"
  },
  medium: {
    card: "14px",
    control: "12px",
    pill: "999px"
  },
  large: {
    card: "18px",
    control: "16px",
    pill: "999px"
  }
};

const COLOR_VALUES = {
  accent: "#0f5cc0",
  critical: "#b42318",
  danger: "#b42318",
  success: "#027a48",
  warning: "#b54708",
  neutral: "#516173",
  muted: "#607284"
};

const TONE_VALUES = {
  neutral: {
    text: "#182026",
    muted: "#607284",
    background: "linear-gradient(180deg, #f5f7fb 0%, #edf2f7 100%)",
    surface: "#ffffff",
    surfaceSubtle: "#fbfcfe",
    border: "#d7e1ec"
  },
  operational: {
    text: "#182026",
    muted: "#607284",
    background: "linear-gradient(180deg, #f5f7fb 0%, #edf2f7 100%)",
    surface: "#ffffff",
    surfaceSubtle: "#fbfcfe",
    border: "#d7e1ec"
  },
  editorial: {
    text: "#1f2933",
    muted: "#5c6670",
    background: "linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)",
    surface: "#ffffff",
    surfaceSubtle: "#f8fafc",
    border: "#d8dee8"
  },
  playful: {
    text: "#1f2937",
    muted: "#5b6472",
    background: "linear-gradient(180deg, #f7fbff 0%, #eef6ff 100%)",
    surface: "#ffffff",
    surfaceSubtle: "#f7fbff",
    border: "#d6e4f5"
  }
};

/**
 * @param {string|null|undefined} value
 * @returns {string}
 */
function cssToken(value) {
  return String(value || "default").replace(/[^A-Za-z0-9_-]/g, "_");
}

/**
 * @param {Record<string, string>|null|undefined} source
 * @param {Record<string, string>} fallback
 * @returns {Record<string, string>}
 */
function mergeStringMap(source, fallback) {
  return {
    ...fallback,
    ...(source && typeof source === "object" ? source : {})
  };
}

/**
 * @param {any} design
 * @returns {{
 *   density: string,
 *   tone: string,
 *   radiusScale: string,
 *   colorRoles: Record<string, string>,
 *   typographyRoles: Record<string, string>,
 *   actionRoles: Record<string, string>,
 *   accessibility: Record<string, string>
 * }}
 */
export function normalizeDesignIntent(design) {
  const value = design && typeof design === "object" ? design : {};
  return {
    density: typeof value.density === "string" ? value.density : DEFAULT_DESIGN_INTENT.density,
    tone: typeof value.tone === "string" ? value.tone : DEFAULT_DESIGN_INTENT.tone,
    radiusScale: typeof value.radiusScale === "string" ? value.radiusScale : DEFAULT_DESIGN_INTENT.radiusScale,
    colorRoles: mergeStringMap(value.colorRoles, DEFAULT_DESIGN_INTENT.colorRoles),
    typographyRoles: mergeStringMap(value.typographyRoles, DEFAULT_DESIGN_INTENT.typographyRoles),
    actionRoles: mergeStringMap(value.actionRoles, DEFAULT_DESIGN_INTENT.actionRoles),
    accessibility: mergeStringMap(value.accessibility, DEFAULT_DESIGN_INTENT.accessibility)
  };
}

/**
 * @param {Record<string, string>} map
 * @param {string} prefix
 * @returns {string[]}
 */
function tokenMapLines(map, prefix) {
  return Object.entries(map)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([role, value]) => `  --topogram-design-${prefix}-${cssToken(role)}: ${cssToken(value)};`);
}

/**
 * @param {any} design
 * @returns {string}
 */
export function renderDesignIntentCss(design) {
  const normalized = normalizeDesignIntent(design);
  const tone = TONE_VALUES[normalized.tone] || TONE_VALUES.neutral;
  const density = DENSITY_VALUES[normalized.density] || DENSITY_VALUES.comfortable;
  const radius = RADIUS_VALUES[normalized.radiusScale] || RADIUS_VALUES.medium;
  const primaryColor = COLOR_VALUES[normalized.colorRoles.primary] || COLOR_VALUES.accent;
  const dangerColor = COLOR_VALUES[normalized.colorRoles.danger] || COLOR_VALUES.critical;
  const focusColor = primaryColor;

  return `/* Topogram semantic design intent. Generators map normalized UI tokens to stack CSS here. */
:root {
  --topogram-design-density: ${cssToken(normalized.density)};
  --topogram-design-tone: ${cssToken(normalized.tone)};
  --topogram-design-radius-scale: ${cssToken(normalized.radiusScale)};
${tokenMapLines(normalized.colorRoles, "color").join("\n")}
${tokenMapLines(normalized.typographyRoles, "typography").join("\n")}
${tokenMapLines(normalized.actionRoles, "action").join("\n")}
${tokenMapLines(normalized.accessibility, "accessibility").join("\n")}
  --topogram-space-unit: ${density.spaceUnit};
  --topogram-page-padding: ${density.pagePadding};
  --topogram-control-padding: ${density.controlPadding};
  --topogram-radius-card: ${radius.card};
  --topogram-radius-control: ${radius.control};
  --topogram-radius-pill: ${radius.pill};
  --topogram-text-color: ${tone.text};
  --topogram-muted-color: ${tone.muted};
  --topogram-surface-background: ${tone.background};
  --topogram-surface-card: ${tone.surface};
  --topogram-surface-subtle: ${tone.surfaceSubtle};
  --topogram-border-color: ${tone.border};
  --topogram-action-primary-background: ${primaryColor};
  --topogram-action-primary-color: #ffffff;
  --topogram-action-danger-background: ${dangerColor};
  --topogram-focus-outline: 3px solid ${focusColor};
}
`;
}

/**
 * @param {ReturnType<typeof normalizeDesignIntent>} design
 * @returns {Array<{ category: string, role: string|null, value: string, marker: string }>}
 */
function requiredDesignMarkers(design) {
  return [
    {
      category: "density",
      role: null,
      value: design.density,
      marker: "--topogram-design-density"
    },
    {
      category: "tone",
      role: null,
      value: design.tone,
      marker: "--topogram-design-tone"
    },
    {
      category: "radius_scale",
      role: null,
      value: design.radiusScale,
      marker: "--topogram-design-radius-scale"
    },
    ...Object.entries(design.colorRoles).map(([role, value]) => ({
      category: "color_roles",
      role,
      value,
      marker: `--topogram-design-color-${cssToken(role)}`
    })),
    ...Object.entries(design.typographyRoles).map(([role, value]) => ({
      category: "typography_roles",
      role,
      value,
      marker: `--topogram-design-typography-${cssToken(role)}`
    })),
    ...Object.entries(design.actionRoles).map(([role, value]) => ({
      category: "action_roles",
      role,
      value,
      marker: `--topogram-design-action-${cssToken(role)}`
    })),
    ...Object.entries(design.accessibility).map(([role, value]) => ({
      category: "accessibility",
      role,
      value,
      marker: `--topogram-design-accessibility-${cssToken(role)}`
    }))
  ];
}

/**
 * @param {any} contract
 * @param {Record<string, string>} files
 * @param {string} cssPath
 * @returns {{ coverage: any, diagnostics: any[] }}
 */
export function buildDesignIntentCoverage(contract, files, cssPath) {
  const design = normalizeDesignIntent(contract?.design);
  const css = files[cssPath] || "";
  const markers = requiredDesignMarkers(design);
  const mapped = markers.filter((item) => css.includes(item.marker));
  const missing = markers.filter((item) => !css.includes(item.marker));
  const coverage = {
    status: missing.length === 0 ? "mapped" : "unmapped",
    css_path: cssPath,
    tokens: {
      density: design.density,
      tone: design.tone,
      radius_scale: design.radiusScale,
      color_roles: design.colorRoles,
      typography_roles: design.typographyRoles,
      action_roles: design.actionRoles,
      accessibility: design.accessibility
    },
    mapped: mapped.map((item) => ({
      category: item.category,
      role: item.role,
      value: item.value,
      marker: item.marker
    })),
    missing: missing.map((item) => ({
      category: item.category,
      role: item.role,
      value: item.value,
      marker: item.marker
    }))
  };
  return {
    coverage,
    diagnostics: missing.map((item) => ({
      code: "design_intent_not_mapped",
      severity: "error",
      category: item.category,
      role: item.role,
      value: item.value,
      marker: item.marker,
      message: `UI design intent token '${item.category}${item.role ? `.${item.role}` : ""}' was not mapped into ${cssPath}.`,
      suggested_fix: "Render Topogram semantic design variables with renderDesignIntentCss before writing the web stylesheet."
    }))
  };
}
