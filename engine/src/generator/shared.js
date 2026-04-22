export function refList(items) {
  if (!items || items.length === 0) {
    return "_none_";
  }

  return items.map((item) => `\`${item.id}\``).join(", ");
}

export function symbolList(items) {
  if (!items || items.length === 0) {
    return "_none_";
  }

  return items.map((item) => `\`${item}\``).join(", ");
}

export function fieldSignature(field) {
  const parts = [`\`${field.name}\``, `\`${field.fieldType}\``];
  if (field.requiredness) {
    parts.push(field.requiredness);
  }
  if (field.defaultValue != null) {
    parts.push(`default \`${field.defaultValue}\``);
  }
  if (field.sourceName && field.sourceName !== field.name) {
    parts.push(`from \`${field.sourceName}\``);
  }
  return parts.join(" - ");
}
