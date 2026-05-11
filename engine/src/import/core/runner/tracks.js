// @ts-check

import { getEnrichersForTrack, getExtractorsForTrack } from "../registry.js";
import { normalizeCandidatesForTrack } from "./candidates.js";

/**
 * @param {any} context
 * @param {any[]} extractors
 * @returns {Array<{ extractor: any, detection: any }>}
 */
function sortExtractors(context, extractors) {
  return extractors
    .map((extractor) => ({ extractor, detection: extractor.detect(context) || { score: 0, reasons: [] } }))
    .filter((entry) => entry.detection.score > 0)
    .sort((a, b) => b.detection.score - a.detection.score || a.extractor.id.localeCompare(b.extractor.id));
}

/**
 * @param {string} track
 * @param {Array<{ extractor: any, detection: any }>} detections
 * @returns {Array<{ extractor: any, detection: any }>}
 */
function selectDetectionsForTrack(track, detections) {
  if (track === "db") {
    const prisma = detections.find((entry) => entry.extractor.id === "db.prisma");
    if (prisma) return [prisma];
    const djangoModels = detections.find((entry) => entry.extractor.id === "db.django-models");
    if (djangoModels) return [djangoModels];
    const efCore = detections.find((entry) => entry.extractor.id === "db.ef-core");
    if (efCore) return [efCore];
    const room = detections.find((entry) => entry.extractor.id === "db.room");
    if (room) return [room];
    const swiftData = detections.find((entry) => entry.extractor.id === "db.swiftdata");
    if (swiftData) return [swiftData];
    const dotnetModels = detections.find((entry) => entry.extractor.id === "db.dotnet-models");
    if (dotnetModels) return [dotnetModels];
    const flutterEntities = detections.find((entry) => entry.extractor.id === "db.flutter-entities");
    if (flutterEntities) return [flutterEntities];
    const reactNativeEntities = detections.find((entry) => entry.extractor.id === "db.react-native-entities");
    if (reactNativeEntities) return [reactNativeEntities];
    const railsSchema = detections.find((entry) => entry.extractor.id === "db.rails-schema");
    if (railsSchema) return [railsSchema];
    const liquibase = detections.find((entry) => entry.extractor.id === "db.liquibase");
    if (liquibase) return [liquibase];
    const myBatisXml = detections.find((entry) => entry.extractor.id === "db.mybatis-xml");
    if (myBatisXml) return [myBatisXml];
    const jpa = detections.find((entry) => entry.extractor.id === "db.jpa");
    if (jpa) return [jpa];
    const drizzle = detections.find((entry) => entry.extractor.id === "db.drizzle");
    if (drizzle) return [drizzle];
    const sql = detections.find((entry) => entry.extractor.id === "db.sql");
    if (sql) return [sql];
    const snapshot = detections.find((entry) => entry.extractor.id === "db.snapshot");
    return snapshot ? [snapshot] : [];
  }
  if (track === "api") {
    const openApi = detections.find((entry) => entry.extractor.id === "api.openapi");
    if (openApi) return [openApi];
    const openApiCode = detections.find((entry) => entry.extractor.id === "api.openapi-code");
    if (openApiCode) return [openApiCode];
    const graphQlSdl = detections.find((entry) => entry.extractor.id === "api.graphql-sdl");
    if (graphQlSdl) return [graphQlSdl];
    const trpc = detections.find((entry) => entry.extractor.id === "api.trpc");
    if (trpc) return [trpc];
    const aspNetCore = detections.find((entry) => entry.extractor.id === "api.aspnet-core");
    if (aspNetCore) return [aspNetCore];
    const retrofit = detections.find((entry) => entry.extractor.id === "api.retrofit");
    if (retrofit) return [retrofit];
    const swiftWebApi = detections.find((entry) => entry.extractor.id === "api.swift-webapi");
    if (swiftWebApi) return [swiftWebApi];
    const flutterDio = detections.find((entry) => entry.extractor.id === "api.flutter-dio");
    if (flutterDio) return [flutterDio];
    const reactNativeRepository = detections.find((entry) => entry.extractor.id === "api.react-native-repository");
    if (reactNativeRepository) return [reactNativeRepository];
    const fastify = detections.find((entry) => entry.extractor.id === "api.fastify");
    if (fastify) return [fastify];
    const express = detections.find((entry) => entry.extractor.id === "api.express");
    if (express) return [express];
    const djangoRoutes = detections.find((entry) => entry.extractor.id === "api.django-routes");
    if (djangoRoutes) return [djangoRoutes];
    const railsRoutes = detections.find((entry) => entry.extractor.id === "api.rails-routes");
    if (railsRoutes) return [railsRoutes];
    const micronaut = detections.find((entry) => entry.extractor.id === "api.micronaut");
    if (micronaut) return [micronaut];
    const jaxrs = detections.find((entry) => entry.extractor.id === "api.jaxrs");
    if (jaxrs) return [jaxrs];
    const springWeb = detections.find((entry) => entry.extractor.id === "api.spring-web");
    if (springWeb) return [springWeb];
  }
  return detections;
}

/**
 * @param {string} track
 * @returns {any}
 */
function initialCandidatesForTrack(track) {
  if (track === "db") {
    return { entities: [], enums: [], relations: [], indexes: [], maintained_seams: [] };
  }
  if (track === "api") {
    return { capabilities: [], routes: [], stacks: [] };
  }
  if (track === "ui") {
    return { screens: [], routes: [], actions: [], stacks: [] };
  }
  if (track === "cli") {
    return { commands: [], capabilities: [], surfaces: [] };
  }
  if (track === "verification") {
    return { verifications: [], scenarios: [], frameworks: [], scripts: [] };
  }
  return { workflows: [], workflow_states: [], workflow_transitions: [] };
}

/**
 * @param {any} context
 * @param {string} track
 * @returns {{ findings: any[], candidates: any, extractor_detections: any[] }}
 */
export function runTrack(context, track) {
  const findings = [];
  const rawCandidates = initialCandidatesForTrack(track);

  for (const { extractor, detection } of selectDetectionsForTrack(track, sortExtractors(context, getExtractorsForTrack(track)))) {
    const result = extractor.extract(context) || { findings: [], candidates: {} };
    findings.push({
      extractor: extractor.id,
      detection,
      findings: result.findings || []
    });
    for (const [key, value] of Object.entries(result.candidates || {})) {
      if (Array.isArray(rawCandidates[key])) {
        rawCandidates[key].push(...value);
      } else if (Array.isArray(value)) {
        rawCandidates[key] = [...value];
      }
    }
  }

  let candidates = normalizeCandidatesForTrack(track, rawCandidates);
  for (const enricher of getEnrichersForTrack(track)) {
    const applies = enricher.applies(context, candidates);
    if (!applies) continue;
    candidates = normalizeCandidatesForTrack(track, enricher.enrich(context, candidates) || candidates);
  }

  return {
    findings: findings.flatMap((entry) => entry.findings || []),
    candidates,
    extractor_detections: findings.map(({ extractor, detection }) => ({ extractor, ...detection }))
  };
}
