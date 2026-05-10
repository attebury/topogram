/**
 * @param {any} id
 * @returns {any}
 */
export function routeSegmentFromCapabilityId(id) {
  return id.replace(/^cap_/, "").replace(/_/g, "-");
}

/**
 * @param {any} capability
 * @returns {any}
 */
export function methodFromCapability(capability) {
  if (capability.creates.length > 0) return "POST";
  if (capability.updates.length > 0) return "PATCH";
  if (capability.deletes.length > 0) return "DELETE";
  return "GET";
}

/**
 * @param {any} capability
 * @returns {any}
 */
export function pathFromCapability(capability) {
  const resourceRef =
    capability.creates[0]?.target ||
    capability.updates[0]?.target ||
    capability.deletes[0]?.target ||
    capability.reads[0]?.target;

  const resourceSegment = resourceRef?.id ? resourceRef.id.replace(/^entity_/, "").replace(/_/g, "-") : "resource";
  const opSegment = routeSegmentFromCapabilityId(capability.id);

  if (capability.creates.length > 0) {
    return `/${resourceSegment}`;
  }
  if (capability.updates.length > 0 || capability.deletes.length > 0) {
    return `/${resourceSegment}/{id}`;
  }
  if (capability.id.startsWith("cap_list_")) {
    return `/${resourceSegment}`;
  }
  return `/${resourceSegment}/${opSegment}`;
}

/**
 * @param {any} responseEntry
 * @returns {any}
 */
export function normalizeResponseMetadata(responseEntry) {
  return {
    mode: responseEntry?.mode || null,
    itemShapeId: responseEntry?.item?.id || null,
    ordering: responseEntry?.sort
      ? {
          field: responseEntry.sort.field,
          direction: responseEntry.sort.direction
        }
      : null,
    cursor: responseEntry?.cursor
      ? {
          requestAfter: responseEntry.cursor.requestAfter,
          responseNext: responseEntry.cursor.responseNext,
          responsePrev: responseEntry.cursor.responsePrev || null
        }
      : null,
    limit: responseEntry?.limit
      ? {
          field: responseEntry.limit.field,
          defaultValue: responseEntry.limit.defaultValue,
          maxValue: responseEntry.limit.maxValue
        }
      : null,
    total: responseEntry?.total
      ? {
          included: responseEntry.total.included
        }
      : null
  };
}

/**
 * @param {any} graph
 * @param {any} capability
 * @returns {any}
 */
export function apiMetadataForCapability(graph, capability) {
  const projections = graph.byKind.projection || [];

  for (const projection of projections) {
    const httpEntry = (projection.http || []).find(/** @param {any} entry */ (entry) => entry.capability?.id === capability.id);
    if (!httpEntry) continue;

    const responseEntry = (projection.httpResponses || []).find(/** @param {any} entry */ (entry) => entry.capability?.id === capability.id);
    return {
      projection: {
        id: projection.id,
        name: projection.name || projection.id
      },
      method: httpEntry.method || methodFromCapability(capability),
      path: httpEntry.path || pathFromCapability(capability),
      success: httpEntry.success || (capability.creates.length > 0 ? 201 : 200),
      auth: httpEntry.auth || "none",
      request: httpEntry.request || (capability.input.length > 0 ? "body" : "none"),
      errorMappings: (projection.httpErrors || [])
        .filter(/** @param {any} entry */ (entry) => entry.capability?.id === capability.id)
        .map(/** @param {any} entry */ (entry) => ({
          code: entry.code,
          status: entry.status
        })),
      fieldBindings: (projection.httpFields || []).filter(/** @param {any} entry */ (entry) => entry.capability?.id === capability.id),
      preconditions: (projection.httpPreconditions || [])
        .filter(/** @param {any} entry */ (entry) => entry.capability?.id === capability.id)
        .map(/** @param {any} entry */ (entry) => ({
          header: entry.header,
          required: entry.required,
          error: entry.error,
          source: entry.source,
          code: entry.code
        })),
      idempotency: (projection.httpIdempotency || [])
        .filter(/** @param {any} entry */ (entry) => entry.capability?.id === capability.id)
        .map(/** @param {any} entry */ (entry) => ({
          header: entry.header,
          required: entry.required,
          error: entry.error,
          code: entry.code
        })),
      cache: (projection.httpCache || [])
        .filter(/** @param {any} entry */ (entry) => entry.capability?.id === capability.id)
        .map(/** @param {any} entry */ (entry) => ({
          responseHeader: entry.responseHeader,
          requestHeader: entry.requestHeader,
          required: entry.required,
          notModified: entry.notModified,
          source: entry.source,
          code: entry.code
        })),
      delete: (projection.httpDelete || [])
        .filter(/** @param {any} entry */ (entry) => entry.capability?.id === capability.id)
        .map(/** @param {any} entry */ (entry) => ({
          mode: entry.mode,
          field: entry.field,
          value: entry.value,
          response: entry.response
        })),
      async: (projection.httpAsync || [])
        .filter(/** @param {any} entry */ (entry) => entry.capability?.id === capability.id)
        .map(/** @param {any} entry */ (entry) => ({
          mode: entry.mode,
          accepted: entry.accepted,
          locationHeader: entry.locationHeader,
          retryAfterHeader: entry.retryAfterHeader,
          statusPath: entry.statusPath,
          statusCapability: entry.statusCapability,
          job: entry.job
        })),
      status: (projection.httpStatus || [])
        .filter(/** @param {any} entry */ (entry) => entry.capability?.id === capability.id)
        .map(/** @param {any} entry */ (entry) => ({
          asyncFor: entry.asyncFor,
          stateField: entry.stateField,
          completed: entry.completed,
          failed: entry.failed,
          expired: entry.expired,
          downloadCapability: entry.downloadCapability,
          downloadField: entry.downloadField,
          errorField: entry.errorField
        })),
      download: (projection.httpDownload || [])
        .filter(/** @param {any} entry */ (entry) => entry.capability?.id === capability.id)
        .map(/** @param {any} entry */ (entry) => ({
          asyncFor: entry.asyncFor,
          media: entry.media,
          filename: entry.filename,
          disposition: entry.disposition
        })),
      authz: (projection.httpAuthz || [])
        .filter(/** @param {any} entry */ (entry) => entry.capability?.id === capability.id)
        .map(/** @param {any} entry */ (entry) => ({
          role: entry.role,
          permission: entry.permission,
          claim: entry.claim,
          claimValue: entry.claimValue,
          ownership: entry.ownership,
          ownershipField: entry.ownershipField
        })),
      callbacks: (projection.httpCallbacks || [])
        .filter(/** @param {any} entry */ (entry) => entry.capability?.id === capability.id)
        .map(/** @param {any} entry */ (entry) => ({
          event: entry.event,
          targetField: entry.targetField,
          method: entry.method,
          payload: entry.payload,
          success: entry.success
        })),
      response: normalizeResponseMetadata(responseEntry)
    };
  }

  return {
    projection: null,
    method: methodFromCapability(capability),
    path: pathFromCapability(capability),
    success: capability.creates.length > 0 ? 201 : 200,
    auth: "none",
    request: capability.input.length > 0 ? "body" : "none",
    errorMappings: [],
    fieldBindings: [],
    preconditions: [],
    idempotency: [],
    cache: [],
    delete: [],
    async: [],
    status: [],
    download: [],
    authz: [],
    callbacks: [],
    response: normalizeResponseMetadata(null)
  };
}
