// @ts-check

/** @param {string} value @returns {any} */
export function provenanceList(value) {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value.filter(Boolean) : [value].filter(Boolean);
}

/** @param {CandidateBundle} bundle @returns {any} */
export function collectBundleProvenance(bundle) {
  const values = new Set();
  for (const entry of bundle.docs || []) {
    for (const provenance of provenanceList(entry.provenance)) values.add(provenance);
  }
  for (const entry of bundle.workflows || []) {
    for (const provenance of provenanceList(entry.provenance)) values.add(provenance);
  }
  for (const entry of bundle.capabilities || []) {
    for (const provenance of provenanceList(entry.provenance)) values.add(provenance);
  }
  for (const entry of bundle.screens || []) {
    for (const provenance of provenanceList(entry.provenance)) values.add(provenance);
  }
  for (const entry of bundle.entities || []) {
    for (const provenance of provenanceList(entry.provenance)) values.add(provenance);
  }
  return values;
}

/** @param {CandidateBundle} bundle @returns {any} */
export function contextualEvidenceScore(bundle) {
  return (
    (bundle.docs || []).length * 4 +
    (bundle.workflows || []).length * 4 +
    (bundle.capabilities || []).length * 3 +
    (bundle.screens || []).length * 2 +
    (bundle.entities || []).length * 2
  );
}

/** @param {CandidateBundle} bundle @returns {any} */
export function collectBundleDocIds(bundle) {
  return new Set((bundle.docs || []).map((/** @type {any} */ entry) => entry.id));
}

/** @param {CandidateBundle} bundle @returns {any} */
export function collectBundleCapabilityIds(bundle) {
  return new Set([
    ...(bundle.capabilities || []).map((/** @type {any} */ entry) => entry.id_hint),
    ...(bundle.verifications || []).flatMap((/** @type {any} */ entry) => entry.related_capabilities || [])
  ]);
}

/** @param {CandidateBundle} bundle @returns {any} */
export function collectBundleRuleIds(bundle) {
  return [...new Set([
    ...(bundle.docs || []).flatMap((/** @type {any} */ entry) => entry.related_rules || []),
    ...(bundle.docLinkSuggestions || []).flatMap((/** @type {any} */ entry) => entry.add_related_rules || []),
    ...(bundle.docMetadataPatches || []).flatMap((/** @type {any} */ entry) => entry.related_rules || [])
  ])].sort();
}


/** @param {CandidateBundle} bundle @returns {any} */
export function primaryEntityIdForBundle(bundle) {
  const entityIds = [
    ...(bundle.entities || []).map((/** @type {any} */ entry) => entry.id_hint),
    ...(bundle.capabilities || []).map((/** @type {any} */ entry) => entry.entity_id).filter(Boolean),
    ...(bundle.screens || []).map((/** @type {any} */ entry) => entry.entity_id).filter(Boolean),
    ...(bundle.workflows || []).map((/** @type {any} */ entry) => entry.entity_id).filter(Boolean)
  ];
  return entityIds.find(Boolean) || null;
}
