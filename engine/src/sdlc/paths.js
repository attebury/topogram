import path from "node:path";

export function topogramRootForSdlc(inputPath) {
  const absolute = path.resolve(inputPath);
  return path.basename(absolute) === "topogram" ? absolute : path.join(absolute, "topogram");
}

export function projectRootForSdlc(inputPath) {
  const absolute = path.resolve(inputPath);
  return path.basename(absolute) === "topogram" ? path.dirname(absolute) : absolute;
}
