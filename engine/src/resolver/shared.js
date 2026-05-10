import { blockEntries, getFieldValue, symbolValues, valueAsArray } from "../validator.js";

export function groupBy(items, keyFn) {
  const grouped = {};
  for (const item of items) {
    const key = keyFn(item);
    if (!Object.hasOwn(grouped, key)) {
      grouped[key] = [];
    }
    grouped[key].push(item);
  }
  return grouped;
}

export function resolveReference(registry, id) {
  return registry.get(id) || null;
}

export function toRef(target) {
  if (!target) {
    return null;
  }

  return {
    id: target.id,
    kind: target.kind
  };
}

export function resolveReferenceList(registry, value) {
  return symbolValues(value).map((id) => ({
    id,
    target: toRef(resolveReference(registry, id))
  }));
}

export function resolveDomainTag(statement, registry) {
  const domainField = statement.fields.find((field) => field.key === "domain");
  if (!domainField || domainField.value.type !== "symbol") {
    return null;
  }
  const id = domainField.value.value;
  return {
    id,
    target: toRef(resolveReference(registry, id))
  };
}

export function normalizeDomainScopeList(statement, key) {
  const field = statement.fields.find((f) => f.key === key);
  if (!field) return [];
  const items = field.value.type === "list" || field.value.type === "sequence"
    ? field.value.items
    : [field.value];
  return items
    .map((item) => (item.type === "string" || item.type === "symbol" ? item.value : null))
    .filter((value) => value !== null);
}

export function normalizeSequence(items) {
  return items.map((item) => {
    if (item.type === "symbol" || item.type === "string") {
      return item.value;
    }
    if (item.type === "list") {
      return item.items.map((nested) => nested.value);
    }
    return item.type;
  });
}

export function normalizeFieldsBlock(statement, key = "fields") {
  return blockEntries(getFieldValue(statement, key)).map((entry) => {
    const [name, type, requiredness, ...rest] = entry.items;
    let defaultValue = null;

    for (let i = 0; i < rest.length - 1; i += 1) {
      if (rest[i].type === "symbol" && rest[i].value === "default") {
        defaultValue = rest[i + 1]?.value ?? null;
      }
    }

    return {
      name: name?.value ?? null,
      fieldType: type?.value ?? null,
      requiredness: requiredness?.value ?? null,
      defaultValue,
      raw: normalizeSequence(entry.items),
      loc: entry.loc
    };
  });
}

export function normalizeGenericBlock(statement, key) {
  return blockEntries(getFieldValue(statement, key)).map((entry) => ({
    raw: normalizeSequence(entry.items),
    loc: entry.loc
  }));
}

export function tokenValue(token) {
  return token?.value ?? null;
}

export function parseDefaultLiteral(token) {
  if (!token) return null;
  if (token.type === "list") {
    return (token.items || []).map((item) => parseDefaultLiteral(item));
  }
  if (token.type === "string") {
    return token.value ?? null;
  }
  if (token.type === "symbol") {
    if (token.value === "true") return true;
    if (token.value === "false") return false;
    if (token.value === "null") return null;
    if (/^-?\d+$/.test(token.value)) return Number.parseInt(token.value, 10);
    if (/^-?\d+\.\d+$/.test(token.value)) return Number.parseFloat(token.value);
    return token.value;
  }
  return token.value ?? null;
}

export function parseLiteralToken(token) {
  const value = tokenValue(token);
  if (value == null) {
    return null;
  }

  if (value === "true") {
    return { kind: "boolean", value: true };
  }
  if (value === "false") {
    return { kind: "boolean", value: false };
  }
  if (value === "null") {
    return { kind: "null", value: null };
  }
  if (/^-?\d+$/.test(value)) {
    return { kind: "integer", value: Number.parseInt(value, 10) };
  }
  if (/^-?\d+\.\d+$/.test(value)) {
    return { kind: "number", value: Number.parseFloat(value) };
  }

  return { kind: "symbol", value };
}

export function parseComparison(left, operator, right) {
  if (!left || !operator || !right) {
    return null;
  }

  return {
    type: "comparison",
    left: tokenValue(left),
    operator,
    right: parseLiteralToken(right)
  };
}

export function parseInvariantEntry(entry) {
  const tokens = entry.items;
  const values = tokens.map((item) => item.value);
  const [a, b, c, d, e, f, g] = tokens;

  if (tokenValue(b) === "requires") {
    return {
      type: "requires",
      field: tokenValue(a),
      predicate: parseComparison(c, tokenValue(d), e),
      raw: values,
      loc: entry.loc
    };
  }

  if (tokenValue(b) === "length") {
    return {
      type: "length_check",
      field: tokenValue(a),
      operator: tokenValue(c),
      value: parseLiteralToken(d),
      raw: values,
      loc: entry.loc
    };
  }

  if (tokenValue(b) === "format") {
    return {
      type: "format_check",
      field: tokenValue(a),
      operator: tokenValue(c),
      format: tokenValue(d),
      raw: values,
      loc: entry.loc
    };
  }

  if (tokenValue(d) === "implies") {
    return {
      type: "implication",
      when: parseComparison(a, tokenValue(b), c),
      then:
        tokenValue(f) === "is"
          ? {
              type: "state_check",
              field: tokenValue(e),
              operator: "is",
              value: parseLiteralToken(g)
            }
          : parseComparison(e, tokenValue(f), g),
      raw: values,
      loc: entry.loc
    };
  }

  if (["==", "!=", "<", "<=", ">", ">="].includes(tokenValue(b))) {
    return {
      type: "comparison",
      left: tokenValue(a),
      operator: tokenValue(b),
      right: parseLiteralToken(c),
      raw: values,
      loc: entry.loc
    };
  }

  return {
    type: "unknown",
    raw: values,
    loc: entry.loc
  };
}

export function parseRuleExpression(value) {
  const text = valueAsArray(value).map((item) => item.value).join(" ").trim();
  const match = text.match(/^(.+?)\s*(==|!=|<=|>=|<|>)\s*(.+)$/);
  if (!match) {
    return {
      type: "unknown",
      raw: text
    };
  }

  return {
    type: "comparison",
    left: match[1].trim(),
    operator: match[2],
    right: {
      kind: "symbol",
      value: match[3].trim()
    },
    raw: text
  };
}

export function parseSymbolNode(value) {
  return {
    type: "symbol",
    id: value
  };
}

export function parseSymbolNodes(values) {
  return values.map((value, index) => ({
    ...parseSymbolNode(value),
    order: index
  }));
}

export function parseReferenceNodes(values) {
  return values.map((entry, index) => ({
    type: "reference",
    id: entry.id,
    target: entry.target || { id: entry.id, kind: null },
    order: index
  }));
}
