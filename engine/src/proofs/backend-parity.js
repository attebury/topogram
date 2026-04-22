import { generateBackendTarget } from "../generator/apps/backend/index.js";

export function buildBackendParityEvidence(graph, projectionId = "proj_api") {
  const hono = generateBackendTarget("hono-server", graph, { projectionId });
  const express = generateBackendTarget("express-server", graph, { projectionId });
  const honoServerContract = hono["src/lib/topogram/server-contract.ts"] || "";
  const expressServerContract = express["src/lib/topogram/server-contract.ts"] || "";
  const honoApp = hono["src/lib/server/app.ts"] || "";
  const expressApp = express["src/lib/server/app.ts"] || "";

  return {
    projectionId,
    honoServerContract,
    expressServerContract,
    sharedServerContract: honoServerContract === expressServerContract,
    honoTargetMarker: honoApp.includes('import { Hono } from "hono";'),
    expressTargetMarker: expressApp.includes('import express, { type Request, type Response } from "express";')
  };
}
