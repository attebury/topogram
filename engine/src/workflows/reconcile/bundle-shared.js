// @ts-nocheck

export function provenanceList(value) {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value.filter(Boolean) : [value].filter(Boolean);
}

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

export function contextualEvidenceScore(bundle) {
  return (
    (bundle.docs || []).length * 4 +
    (bundle.workflows || []).length * 4 +
    (bundle.capabilities || []).length * 3 +
    (bundle.screens || []).length * 2 +
    (bundle.entities || []).length * 2
  );
}

export function collectBundleDocIds(bundle) {
  return new Set((bundle.docs || []).map((entry) => entry.id));
}

export function collectBundleCapabilityIds(bundle) {
  return new Set([
    ...(bundle.capabilities || []).map((entry) => entry.id_hint),
    ...(bundle.verifications || []).flatMap((entry) => entry.related_capabilities || [])
  ]);
}

export function collectBundleRuleIds(bundle) {
  return [...new Set([
    ...(bundle.docs || []).flatMap((entry) => entry.related_rules || []),
    ...(bundle.docLinkSuggestions || []).flatMap((entry) => entry.add_related_rules || []),
    ...(bundle.docMetadataPatches || []).flatMap((entry) => entry.related_rules || [])
  ])].sort();
}


export function primaryEntityIdForBundle(bundle) {
  const entityIds = [
    ...(bundle.entities || []).map((entry) => entry.id_hint),
    ...(bundle.capabilities || []).map((entry) => entry.entity_id).filter(Boolean),
    ...(bundle.screens || []).map((entry) => entry.entity_id).filter(Boolean),
    ...(bundle.workflows || []).map((entry) => entry.entity_id).filter(Boolean)
  ];
  return entityIds.find(Boolean) || null;
}
