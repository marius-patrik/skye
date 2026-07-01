#!/usr/bin/env bun

import { startGateway } from "./index.ts";

const portArg = process.argv.find((arg) => arg.startsWith("--port="));
const hostArg = process.argv.find((arg) => arg.startsWith("--host="));
const tokenArg = process.argv.find((arg) => arg.startsWith("--token="));
const token = tokenArg ? tokenArg.slice("--token=".length) : "";

if (!token) {
  process.stderr.write("skyagent gateway requires --token=<token>. Process-managed token persistence is added by the CLI gateway commands.\n");
  process.exit(1);
}

const gateway = startGateway({
  port: portArg ? Number(portArg.slice("--port=".length)) : 0,
  host: hostArg ? hostArg.slice("--host=".length) : "127.0.0.1",
  token,
});

process.stdout.write(`${JSON.stringify(gateway.status, null, 2)}\n`);
