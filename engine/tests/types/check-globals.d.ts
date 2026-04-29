declare module "node:fs" {
  const fs: any;
  export default fs;
}

declare module "node:path" {
  const path: any;
  export default path;
}

declare module "node:child_process" {
  const childProcess: any;
  export default childProcess;
}

declare module "node:os" {
  const os: any;
  export default os;
}

declare const process: any;
