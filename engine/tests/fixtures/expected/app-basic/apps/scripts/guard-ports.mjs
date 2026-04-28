#!/usr/bin/env node
import net from "node:net";

const role = process.argv[2] || "stack";
const ports = [
  {
    "id": "app_api",
    "type": "api",
    "env": "APP_API_PORT",
    "fallbackEnv": "SERVER_PORT",
    "port": 3000
  },
  {
    "id": "app_sveltekit",
    "type": "web",
    "env": "APP_SVELTEKIT_PORT",
    "fallbackEnv": "WEB_PORT",
    "port": 5173
  }
];
const expectedService = "topogram-todo-server";

function effectivePort(entry) {
  return Number(process.env[entry.env] || process.env[entry.fallbackEnv] || entry.port);
}

function portInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", (error) => {
      resolve(Boolean(error && error.code === "EADDRINUSE"));
    });
    server.once("listening", () => {
      server.close(() => resolve(false));
    });
    server.listen(port, "127.0.0.1");
  });
}

async function readHealth(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    const body = await response.json().catch(() => null);
    return { status: response.status, body };
  } catch {
    return null;
  }
}

async function failForServerPort(port) {
  const health = await readHealth(port);
  if (health?.body?.service && expectedService && health.body.service !== expectedService) {
    console.error(`Port ${port} is already serving ${health.body.service}, not ${expectedService}.`);
    console.error("Stop the other stack or override SERVER_PORT/PUBLIC_TOPOGRAM_API_BASE_URL before retrying.");
    process.exit(1);
  }
  if (health?.body?.service) {
    console.error(`Port ${port} is already in use by ${health.body.service}.`);
  } else {
    console.error(`Port ${port} is already in use.`);
  }
  process.exit(1);
}

async function failForWebPort(port) {
  console.error(`Port ${port} is already in use.`);
  console.error("Stop the other web dev server or override WEB_PORT before retrying.");
  process.exit(1);
}

for (const entry of ports) {
  if (role !== "stack" && role !== entry.type) {
    continue;
  }
  const port = effectivePort(entry);
  if (await portInUse(port)) {
    if (entry.type === "api") {
      await failForServerPort(port);
    }
    await failForWebPort(port);
  }
}
