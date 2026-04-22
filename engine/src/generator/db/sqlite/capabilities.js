export const SQLITE_CAPABILITIES = {
  default: {
    family: "sqlite",
    profiles: ["default"],
    supportsEnums: false,
    supportsPrisma: true,
    supportsDrizzle: false,
    supportsGeneratedBundles: true
  }
};

export function resolveSqliteCapabilities(profileId = "default") {
  return SQLITE_CAPABILITIES[profileId] || SQLITE_CAPABILITIES.default;
}
