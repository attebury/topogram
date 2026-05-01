// Per-kind dispatch for SDLC transitions.

import * as pitch from "./pitch.js";
import * as requirement from "./requirement.js";
import * as acceptanceCriterion from "./acceptance-criterion.js";
import * as task from "./task.js";
import * as bug from "./bug.js";
import * as document from "./document.js";

const MODULES = {
  pitch,
  requirement,
  acceptance_criterion: acceptanceCriterion,
  task,
  bug,
  document
};

export function getTransitionModule(kind) {
  return MODULES[kind] || null;
}

export function legalTransitionsFor(kind, from) {
  const mod = MODULES[kind];
  if (!mod) return [];
  return mod.LEGAL_TRANSITIONS[from] || [];
}

export function isTerminalStatus(kind, status) {
  const mod = MODULES[kind];
  if (!mod) return false;
  return mod.TERMINAL_STATUSES.has(status);
}

export function isArchivableStatus(kind, status) {
  const mod = MODULES[kind];
  if (!mod) return false;
  return mod.ARCHIVABLE_STATUSES.has(status);
}

export function validateTransition(kind, from, to) {
  const mod = MODULES[kind];
  if (!mod) {
    return { ok: false, error: `No state machine for kind '${kind}'` };
  }
  return mod.validateTransition(from, to);
}

export {
  pitch,
  requirement,
  acceptanceCriterion,
  task,
  bug,
  document
};
