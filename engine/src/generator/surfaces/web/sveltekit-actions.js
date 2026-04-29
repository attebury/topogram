function indentBlock(block, spaces) {
  const indent = " ".repeat(spaces);
  return block
    .trim()
    .split("\n")
    .map((line) => (line ? `${indent}${line}` : ""))
    .join("\n");
}

export function renderSvelteKitRedirectingAction({
  actionName,
  signature,
  prelude,
  tryStatement,
  catchReturn,
  successStatement
}) {
  return `  ${actionName}: async (${signature}) => {
${indentBlock(prelude, 4)}

    try {
${indentBlock(tryStatement, 6)}
    } catch (error) {
${indentBlock(catchReturn, 6)}
    }
    ${successStatement}
  }`;
}
