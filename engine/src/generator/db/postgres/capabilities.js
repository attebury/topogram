export const POSTGRES_CAPABILITIES = {
  default: {
    family: "postgres",
    profiles: ["default"],
    supportsEnums: true,
    supportsPrisma: true,
    supportsDrizzle: true,
    supportsGeneratedBundles: true
  }
};

export function resolvePostgresCapabilities(profileId = "default") {
  return POSTGRES_CAPABILITIES[profileId] || POSTGRES_CAPABILITIES.default;
}
