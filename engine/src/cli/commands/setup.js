// @ts-check

/**
 * @returns {void}
 */
export function printSetupHelp() {
  console.log("Usage: topogram setup package-auth|catalog-auth");
  console.log("");
  console.log("Prints setup guidance for public Topogram packages, private package auth, and catalog access. This command does not write credentials.");
  console.log("");
  console.log("Commands:");
  console.log("  topogram setup package-auth");
  console.log("  topogram setup catalog-auth");
}

/**
 * @returns {void}
 */
export function printPackageAuthSetup() {
  console.log("Topogram package auth setup");
  console.log("");
  console.log("Public Topogram CLI, generator, template, and starter packages are published to npmjs.");
  console.log("");
  console.log("Local public-package setup:");
  console.log("  npm install --save-dev @topogram/cli");
  console.log("");
  console.log("Private template or generator packages may still require registry-specific npm auth.");
  console.log("Run `topogram doctor` after setup.");
}

/**
 * @returns {void}
 */
export function printCatalogAuthSetup() {
  console.log("Topogram catalog auth setup");
  console.log("");
  console.log("The default Topogram catalog is public and does not require GitHub auth.");
  console.log("Restricted GitHub catalog reads prefer GITHUB_TOKEN or GH_TOKEN. Local `gh auth login` is a fallback when no token env var is set.");
  console.log("");
  console.log("Restricted catalog local setup:");
  console.log("  export GITHUB_TOKEN=<token-with-repo-read>");
  console.log("  topogram catalog list");
  console.log("");
  console.log("Local fallback without token env:");
  console.log("  gh auth login");
  console.log("  topogram catalog list");
  console.log("");
  console.log("Restricted catalog GitHub Actions setup:");
  console.log("  permissions:");
  console.log("    contents: read");
  console.log("  env:");
  console.log("    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}");
  console.log("");
  console.log("For restricted catalog repositories, grant the workflow token or PAT read access.");
  console.log("Run `topogram catalog doctor` after setup.");
}

/**
 * @param {string[]} args
 * @returns {number|null}
 */
export function handleSetupCommand(args) {
  if (args[0] !== "setup") {
    return null;
  }
  if (args[1] === "package-auth") {
    printPackageAuthSetup();
    return 0;
  }
  if (args[1] === "catalog-auth") {
    printCatalogAuthSetup();
    return 0;
  }
  printSetupHelp();
  return args[1] ? 1 : 0;
}
