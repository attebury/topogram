import fs from "node:fs";
import path from "node:path";
import { parseDocsPath } from "./workspace-docs.js";

function createPos(line, column, offset) {
  return { line, column, offset };
}

function createToken(type, value, start, end) {
  return { type, value, start, end };
}

function createError(filePath, message, token) {
  const line = token?.start?.line ?? 1;
  const column = token?.start?.column ?? 1;
  return new Error(`${filePath}:${line}:${column} ${message}`);
}

export function lex(source, filePath = "<memory>") {
  const tokens = [];
  let i = 0;
  let line = 1;
  let column = 1;

  function pos() {
    return createPos(line, column, i);
  }

  function advanceChar(char) {
    i += 1;
    if (char === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }

  function push(type, value, start, end) {
    tokens.push(createToken(type, value, start, end));
  }

  while (i < source.length) {
    const char = source[i];

    if (char === " " || char === "\t" || char === "\r") {
      advanceChar(char);
      continue;
    }

    if (char === "\n") {
      const start = pos();
      advanceChar(char);
      push("newline", "\n", start, pos());
      continue;
    }

    if (char === "#") {
      while (i < source.length && source[i] !== "\n") {
        advanceChar(source[i]);
      }
      continue;
    }

    if (char === "{") {
      const start = pos();
      advanceChar(char);
      push("lbrace", "{", start, pos());
      continue;
    }

    if (char === "}") {
      const start = pos();
      advanceChar(char);
      push("rbrace", "}", start, pos());
      continue;
    }

    if (char === "[") {
      const start = pos();
      advanceChar(char);
      push("lbracket", "[", start, pos());
      continue;
    }

    if (char === "]") {
      const start = pos();
      advanceChar(char);
      push("rbracket", "]", start, pos());
      continue;
    }

    if (char === ",") {
      const start = pos();
      advanceChar(char);
      push("comma", ",", start, pos());
      continue;
    }

    if (char === "\"") {
      const start = pos();
      advanceChar(char);

      let value = "";
      let closed = false;
      while (i < source.length) {
        const current = source[i];
        if (current === "\"") {
          advanceChar(current);
          push("string", value, start, pos());
          closed = true;
          break;
        }

        if (current === "\\") {
          const next = source[i + 1];
          if (next === undefined) {
            throw createError(filePath, "Unterminated string literal", createToken("string", value, start, pos()));
          }
          const escaped = next === "n" ? "\n" : next === "t" ? "\t" : next;
          value += escaped;
          advanceChar(current);
          advanceChar(next);
          continue;
        }

        value += current;
        advanceChar(current);
      }

      if (!closed) {
        throw createError(filePath, "Unterminated string literal", createToken("string", value, start, pos()));
      }

      continue;
    }

    const start = pos();
    let value = "";
    while (i < source.length) {
      const current = source[i];
      if (
        current === " " ||
        current === "\t" ||
        current === "\r" ||
        current === "\n" ||
        current === "#" ||
        current === "{" ||
        current === "}" ||
        current === "[" ||
        current === "]" ||
        current === "," ||
        current === "\""
      ) {
        break;
      }
      value += current;
      advanceChar(current);
    }

    push("word", value, start, pos());
  }

  tokens.push(createToken("eof", "", pos(), pos()));
  return tokens;
}

class Parser {
  constructor(tokens, filePath) {
    this.tokens = tokens;
    this.filePath = filePath;
    this.index = 0;
  }

  current() {
    return this.tokens[this.index];
  }

  previous() {
    return this.tokens[this.index - 1];
  }

  advance() {
    const token = this.current();
    this.index += 1;
    return token;
  }

  check(type, value) {
    const token = this.current();
    return token.type === type && (value === undefined || token.value === value);
  }

  match(type, value) {
    if (!this.check(type, value)) {
      return null;
    }
    return this.advance();
  }

  expect(type, value, message) {
    const token = this.current();
    if (!this.check(type, value)) {
      throw createError(this.filePath, message, token);
    }
    return this.advance();
  }

  skipNewlines() {
    while (this.match("newline")) {
      // Skip layout-only line breaks between statements and fields.
    }
  }

  parseDocument() {
    const statements = [];
    this.skipNewlines();

    while (!this.check("eof")) {
      statements.push(this.parseStatement());
      this.skipNewlines();
    }

    return {
      type: "document",
      file: this.filePath,
      statements
    };
  }

  parseStatement() {
    const kind = this.expect("word", undefined, "Expected statement kind");
    const id = this.expect("word", undefined, "Expected statement identifier");
    const start = kind.start;

    let from = null;
    if (this.match("word", "from")) {
      from = this.expect("word", undefined, "Expected identifier after 'from'");
    }

    this.skipNewlines();
    this.expect("lbrace", undefined, "Expected '{' to start statement body");
    this.skipNewlines();

    const fields = [];
    while (!this.check("rbrace")) {
      fields.push(this.parseField());
      this.skipNewlines();
    }

    const end = this.expect("rbrace", undefined, "Expected '}' to close statement body").end;

    return {
      type: "statement",
      kind: kind.value,
      id: id.value,
      from: from ? this.nodeFromToken(from) : null,
      fields,
      loc: this.loc(start, end)
    };
  }

  parseField() {
    const key = this.expect("word", undefined, "Expected field name");
    const start = key.start;

    if (this.check("lbrace")) {
      const value = this.parseBlock();
      return {
        type: "field",
        key: key.value,
        value,
        loc: this.loc(start, value.loc.end)
      };
    }

    const values = this.parseSequenceUntil(["newline", "rbrace"]);
    if (values.length === 0) {
      throw createError(this.filePath, `Expected value for field '${key.value}'`, this.current());
    }

    return {
      type: "field",
      key: key.value,
      value: values.length === 1 ? values[0] : { type: "sequence", items: values, loc: this.loc(values[0].loc.start, values[values.length - 1].loc.end) },
      loc: this.loc(start, values[values.length - 1].loc.end)
    };
  }

  parseBlock() {
    const open = this.expect("lbrace", undefined, "Expected '{' to start block");
    this.skipNewlines();
    const entries = [];

    while (!this.check("rbrace")) {
      const entry = this.parseSequenceUntil(["newline", "rbrace"]);
      if (entry.length === 0) {
        throw createError(this.filePath, "Expected block entry", this.current());
      }
      entries.push({
        type: "block_entry",
        items: entry,
        loc: this.loc(entry[0].loc.start, entry[entry.length - 1].loc.end)
      });
      this.skipNewlines();
    }

    const close = this.expect("rbrace", undefined, "Expected '}' to close block");
    return {
      type: "block",
      entries,
      loc: this.loc(open.start, close.end)
    };
  }

  parseSequenceUntil(stopTypes) {
    const items = [];

    while (!stopTypes.includes(this.current().type) && !this.check("eof")) {
      if (this.match("comma")) {
        continue;
      }
      items.push(this.parseAtom());
    }

    return items;
  }

  parseAtom() {
    const token = this.current();

    if (token.type === "string") {
      this.advance();
      return {
        type: "string",
        value: token.value,
        loc: this.loc(token.start, token.end)
      };
    }

    if (token.type === "word") {
      this.advance();
      return {
        type: "symbol",
        value: token.value,
        loc: this.loc(token.start, token.end)
      };
    }

    if (token.type === "lbracket") {
      return this.parseList();
    }

    throw createError(this.filePath, `Unexpected token '${token.value || token.type}'`, token);
  }

  parseList() {
    const open = this.expect("lbracket", undefined, "Expected '[' to start list");
    const items = [];

    while (!this.check("rbracket")) {
      if (this.match("newline") || this.match("comma")) {
        continue;
      }
      items.push(this.parseAtom());
    }

    const close = this.expect("rbracket", undefined, "Expected ']' to close list");
    return {
      type: "list",
      items,
      loc: this.loc(open.start, close.end)
    };
  }

  nodeFromToken(token) {
    return {
      type: "symbol",
      value: token.value,
      loc: this.loc(token.start, token.end)
    };
  }

  loc(start, end) {
    return {
      file: this.filePath,
      start,
      end
    };
  }
}

export function parseSource(source, filePath = "<memory>") {
  const tokens = lex(source, filePath);
  const parser = new Parser(tokens, filePath);
  return parser.parseDocument();
}

export function parseFile(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  return parseSource(source, filePath);
}

export function collectTopogramFiles(inputPath) {
  const absolutePath = path.resolve(inputPath);
  const stat = fs.statSync(absolutePath);

  if (stat.isFile()) {
    return absolutePath.endsWith(".tg") ? [absolutePath] : [];
  }

  const files = [];
  for (const entry of fs.readdirSync(absolutePath, { withFileTypes: true })) {
    const childPath = path.join(absolutePath, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "candidates" || entry.name === "docs-generated") {
        continue;
      }
      files.push(...collectTopogramFiles(childPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".tg")) {
      files.push(childPath);
    }
  }

  return files.sort();
}

export function parsePath(inputPath) {
  const files = collectTopogramFiles(inputPath);
  const docs = parseDocsPath(inputPath);
  return {
    type: "workspace",
    root: path.resolve(inputPath),
    files: files.map((filePath) => parseFile(filePath)),
    docs
  };
}
