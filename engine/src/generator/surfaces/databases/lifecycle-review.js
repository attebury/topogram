/**
 * @typedef {Object} DbLifecycleReviewCommand
 * @property {string} id
 * @property {string} label
 * @property {string} command
 * @property {string} output
 */

/**
 * @typedef {Object} DbLifecycleReviewWorkflow
 * @property {string} mode
 * @property {boolean} proposalOnly
 * @property {string} tool
 * @property {string} applyBoundary
 * @property {string} snapshotSource
 * @property {DbLifecycleReviewCommand[]} commands
 * @property {string[]} handoffSteps
 */

/**
 * @typedef {Object} DbLifecyclePlanLike
 * @property {{ id: string, name?: string }} projection
 * @property {string} engine
 * @property {string[]} ormProfiles
 * @property {string} inputPath
 * @property {{ ownership: string, tool: string, apply: string, defaulted: boolean }} migrationStrategy
 * @property {{ desiredSnapshot: string, currentSnapshot: string, migrationPlan: string, migrationSql: string }} state
 * @property {{ schemaPath: string | null, migrationsPath: string | null, snapshotPath: string | null }} proposals
 * @property {{ required: string[], optional: string[] }} environment
 * @property {{ proposalOnly: boolean }} behavior
 * @property {DbLifecycleReviewWorkflow} [reviewWorkflow]
 */

/**
 * @param {DbLifecyclePlanLike} plan
 * @returns {DbLifecycleReviewCommand[]}
 */
export function lifecycleReviewCommands(plan) {
  const inputPath = plan.inputPath || ".";
  const projectionFlag = `--projection ${plan.projection.id}`;
  const commands = [
    {
      id: "desired_snapshot",
      label: "Emit the desired DB schema snapshot from the current Topogram",
      command: `topogram emit db-schema-snapshot ${inputPath} ${projectionFlag} --json`,
      output: plan.state.desiredSnapshot
    },
    {
      id: "migration_plan",
      label: "Compare the trusted current snapshot to the desired snapshot",
      command: `topogram emit db-migration-plan ${inputPath} ${projectionFlag} --from-snapshot ${plan.state.currentSnapshot} --json`,
      output: plan.state.migrationPlan
    },
    {
      id: "sql_proposal",
      label: "Emit a SQL proposal for review",
      command: `topogram emit sql-migration ${inputPath} ${projectionFlag} --from-snapshot ${plan.state.currentSnapshot} --write --out-dir ./db-proposals/sql`,
      output: plan.state.migrationSql
    }
  ];

  if (plan.ormProfiles.includes("prisma")) {
    commands.push({
      id: "prisma_schema_proposal",
      label: "Emit a Prisma schema proposal for review",
      command: `topogram emit prisma-schema ${inputPath} ${projectionFlag} --write --out-dir ./db-proposals/prisma`,
      output: "db-proposals/prisma/schema.prisma"
    });
  }

  if (plan.ormProfiles.includes("drizzle")) {
    commands.push({
      id: "drizzle_schema_proposal",
      label: "Emit a Drizzle schema proposal for review",
      command: `topogram emit drizzle-schema ${inputPath} ${projectionFlag} --write --out-dir ./db-proposals/drizzle`,
      output: "db-proposals/drizzle/schema.ts"
    });
  }

  commands.push({
    id: "lifecycle_bundle",
    label: "Emit a repeatable lifecycle proposal bundle",
    command: `topogram emit db-lifecycle-bundle ${inputPath} ${projectionFlag} --write --out-dir ./db-proposals/lifecycle`,
    output: "db-proposals/lifecycle"
  });

  return commands;
}

/**
 * @param {DbLifecyclePlanLike} plan
 * @returns {DbLifecycleReviewWorkflow}
 */
export function lifecycleReviewWorkflow(plan) {
  if (plan.migrationStrategy.ownership === "maintained") {
    return {
      mode: "maintained_proposal",
      proposalOnly: true,
      tool: plan.migrationStrategy.tool,
      applyBoundary: "Topogram never applies maintained database migrations. It emits proposals for human or agent review.",
      snapshotSource: plan.state.currentSnapshot,
      commands: lifecycleReviewCommands(plan),
      handoffSteps: [
        "Review the desired snapshot and migration plan before editing maintained app files.",
        `Adapt accepted proposals into the maintained ${plan.migrationStrategy.tool} migration workflow.`,
        plan.proposals.schemaPath ? `Update the maintained schema at ${plan.proposals.schemaPath} only through the maintained app workflow.` : "Update maintained schema files only through the maintained app workflow.",
        plan.proposals.migrationsPath ? `Create or update migration files under ${plan.proposals.migrationsPath}.` : "Create or update migration files in the maintained app migration directory.",
        "Run the maintained app's own migration command outside Topogram.",
        `After the migration is applied and verified, refresh the trusted current snapshot at ${plan.state.currentSnapshot}.`
      ]
    };
  }

  return {
    mode: "generated_apply",
    proposalOnly: false,
    tool: plan.migrationStrategy.tool,
    applyBoundary: "Topogram owns generated database lifecycle scripts and may apply supported generated SQL migrations.",
    snapshotSource: plan.state.currentSnapshot,
    commands: lifecycleReviewCommands(plan),
    handoffSteps: [
      "Run the generated lifecycle scripts from the generated database bundle.",
      "Stop and review manually when the migration plan reports unsupported or destructive changes.",
      `After a generated migration succeeds, Topogram records the current snapshot at ${plan.state.currentSnapshot}.`
    ]
  };
}

/**
 * @param {DbLifecyclePlanLike} plan
 * @returns {string}
 */
export function renderDbLifecycleReadme(plan) {
  const reviewWorkflow = plan.reviewWorkflow || lifecycleReviewWorkflow(plan);
  const proposalLines = [
    plan.proposals.snapshotPath ? `- Current snapshot source: \`${plan.proposals.snapshotPath}\`` : null,
    plan.proposals.schemaPath ? `- Maintained schema path: \`${plan.proposals.schemaPath}\`` : null,
    plan.proposals.migrationsPath ? `- Maintained migrations path: \`${plan.proposals.migrationsPath}\`` : null
  ].filter(Boolean).join("\n");
  const reviewCommands = reviewWorkflow.commands
    .map((entry) => `- ${entry.label}: \`${entry.command}\``)
    .join("\n");
  const handoffSteps = reviewWorkflow.handoffSteps
    .map((entry) => `- ${entry}`)
    .join("\n");
  const modeText = plan.behavior.proposalOnly
    ? `Maintained proposal mode. Topogram emits desired snapshots, migration plans, SQL proposals, and schema proposals, but these scripts do not apply migrations to the database. A human or agent must adapt accepted proposals into the maintained migration system.`
    : `Generated apply mode. Topogram owns this lifecycle bundle and scripts may apply supported generated SQL migrations. Unsupported or destructive migration plans stop for manual review.`;
  return `# ${plan.projection.name} Lifecycle

This bundle gives agents a repeatable database workflow for projection \`${plan.projection.id}\`.

## Migration Strategy

- Ownership: \`${plan.migrationStrategy.ownership}\`
- Tool: \`${plan.migrationStrategy.tool}\`
- Apply: \`${plan.migrationStrategy.apply}\`
- Defaulted: \`${plan.migrationStrategy.defaulted ? "yes" : "no"}\`

${modeText}
${proposalLines ? `\n${proposalLines}\n` : ""}

## Review Workflow

- Mode: \`${reviewWorkflow.mode}\`
- Apply boundary: ${reviewWorkflow.applyBoundary}
- Snapshot source: \`${reviewWorkflow.snapshotSource}\`

### Review Commands

${reviewCommands}

### Handoff Steps

${handoffSteps}

## Modes

- Greenfield: run \`./scripts/db-bootstrap-or-migrate.sh\` with no current snapshot
- Brownfield: run \`./scripts/db-bootstrap-or-migrate.sh\` with \`state/current.snapshot.json\` already present

## Required Environment

${plan.environment.required.map((name) => `- \`${name}\``).join("\n")}

## Optional Environment

${plan.environment.optional.map((name) => `- \`${name}\``).join("\n")}

## Files

- Desired snapshot: \`${plan.state.desiredSnapshot}\`
- Current snapshot: \`${plan.state.currentSnapshot}\`
- Migration plan: \`${plan.state.migrationPlan}\`
- Migration SQL: \`${plan.state.migrationSql}\`

## Commands

- \`./scripts/db-status.sh\`
- \`./scripts/db-bootstrap.sh\`
- \`./scripts/db-migrate.sh\`
- \`./scripts/db-bootstrap-or-migrate.sh\`
`;
}
