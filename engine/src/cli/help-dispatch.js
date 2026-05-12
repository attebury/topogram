// @ts-check

import {
  printAgentHelp
} from "./commands/agent.js";
import {
  printCatalogHelp
} from "./commands/catalog.js";
import {
  printCheckHelp
} from "./commands/check.js";
import {
  printDoctorHelp
} from "./commands/doctor.js";
import {
  printGeneratorHelp
} from "./commands/generator.js";
import {
  printAdoptHelp,
  printExtractHelp
} from "./commands/import.js";
import {
  printPackageHelp
} from "./commands/package.js";
import {
  printQueryHelp
} from "./commands/query.js";
import {
  printReleaseHelp
} from "./commands/release.js";
import {
  printSetupHelp
} from "./commands/setup.js";
import {
  printSourceHelp
} from "./commands/source.js";
import {
  printTemplateHelp
} from "./commands/template.js";
import {
  printTrustHelp
} from "./commands/trust.js";
import {
  printEmitHelp,
  printGenerateHelp,
  printInitHelp,
  printCopyHelp,
  printUsage,
  printWidgetHelp
} from "./help.js";

/**
 * @param {string|undefined} command
 * @returns {boolean}
 */
export function printCommandHelp(command) {
  if (command === "copy") {
    printCopyHelp();
    return true;
  }
  if (command === "init") {
    printInitHelp();
    return true;
  }
  if (command === "generate") {
    printGenerateHelp();
    return true;
  }
  if (command === "emit") {
    printEmitHelp();
    return true;
  }
  if (command === "widget") {
    printWidgetHelp();
    return true;
  }
  if (command === "query") {
    printQueryHelp();
    return true;
  }
  if (command === "agent") {
    printAgentHelp();
    return true;
  }
  if (command === "generator") {
    printGeneratorHelp();
    return true;
  }
  if (command === "template") {
    printTemplateHelp();
    return true;
  }
  if (command === "catalog") {
    printCatalogHelp();
    return true;
  }
  if (command === "doctor") {
    printDoctorHelp();
    return true;
  }
  if (command === "setup") {
    printSetupHelp();
    return true;
  }
  if (command === "package") {
    printPackageHelp();
    return true;
  }
  if (command === "release") {
    printReleaseHelp();
    return true;
  }
  if (command === "source") {
    printSourceHelp();
    return true;
  }
  if (command === "trust") {
    printTrustHelp();
    return true;
  }
  if (command === "extract") {
    printExtractHelp();
    return true;
  }
  if (command === "adopt") {
    printAdoptHelp();
    return true;
  }
  if (command === "check") {
    printCheckHelp();
    return true;
  }
  return false;
}

/**
 * @param {string[]} args
 * @returns {number|null}
 */
export function handleGlobalHelp(args) {
  if (args[0] === "help" && args[1] && args[1] !== "all" && printCommandHelp(args[1])) {
    return 0;
  }

  if (args[0] !== "version" && (args.includes("--help") || args.includes("-h")) && printCommandHelp(args[0])) {
    return 0;
  }

  if (args.length === 0 || (args[0] !== "version" && args.includes("--help")) || args.includes("-h") || args[0] === "help") {
    printUsage({ all: args[1] === "all" || args.includes("--all") });
    return args.length === 0 ? 1 : 0;
  }

  if (args[0] === "help-all") {
    printUsage({ all: true });
    return 0;
  }

  return null;
}

/**
 * @param {string[]} args
 * @returns {number|null}
 */
export function handleUnparsedCommandHelp(args) {
  if (args[0] === "widget") {
    printWidgetHelp();
    return args[1] ? 1 : 0;
  }
  if (args[0] === "agent") {
    printAgentHelp();
    return args[1] ? 1 : 0;
  }
  if (args[0] === "generator") {
    printGeneratorHelp();
    return args[1] ? 1 : 0;
  }
  if (args[0] === "template") {
    printTemplateHelp();
    return args[1] ? 1 : 0;
  }
  if (args[0] === "extract") {
    printExtractHelp();
    return args[1] ? 1 : 0;
  }
  if (args[0] === "adopt") {
    printAdoptHelp();
    return args[1] ? 1 : 0;
  }
  if (args[0] === "query") {
    printQueryHelp();
    return args[1] ? 1 : 0;
  }
  return null;
}

export {
  printEmitHelp,
  printQueryHelp,
  printUsage
};
