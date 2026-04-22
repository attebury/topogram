export const authSessionEnricher = {
  id: "enricher.auth-session",
  track: "api",
  applies(_context, candidates) {
    return (candidates.capabilities || []).some((entry) => entry.auth_hint === "public" || entry.auth_hint === "secured");
  },
  enrich(_context, candidates) {
    return {
      ...candidates,
      capabilities: (candidates.capabilities || []).map((entry) => ({
        ...entry,
        actor_hints:
          entry.actor_hints ||
          (entry.auth_hint === "secured" ? ["user"] : entry.auth_hint === "public" ? ["anonymous"] : [])
      }))
    };
  }
};
