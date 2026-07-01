import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, test } from "bun:test";
import { stopGatewayProcess } from "@skyagent/gateway/manager";
import { connectTuiGateway, SkyAgentTuiApp, tuiSnapshot, tuiStatus } from "../src/index.tsx";

let tempHome: string | null = null;

afterEach(async () => {
  if (tempHome) {
    await stopGatewayProcess();
    fs.rmSync(tempHome, { recursive: true, force: true });
    tempHome = null;
  }
  delete process.env.SKYAGENT_HOME;
});

function isolatedSkyAgentHome() {
  tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "skyagent-tui-test-"));
  process.env.SKYAGENT_HOME = tempHome;
}

test("tui status initializes without live credentials", () => {
  const status = tuiStatus();

  expect(status.surface).toBe("tui");
  expect(status.renderer).toBe("ink");
  expect(status.ready).toBe(true);
  expect(status.config.apiKeyConfigured).toBeTypeOf("boolean");
});

test("tui smoke snapshot exposes screens and does not print secrets", () => {
  const snapshot = tuiSnapshot();

  expect(snapshot.screens).toContain("status");
  expect(snapshot.screens).toContain("profiles");
  expect(snapshot.screens).toContain("overview");
  expect(snapshot.screens).toContain("debug");
  expect(snapshot.shortcuts).toContain("up/down or j/k");
  expect(snapshot.shortcuts).toContain("left/right or h/l");
  expect(snapshot.secrets).toContain("never printed");
  expect(snapshot.renderer).toBe("ink");
});

test("tui exports an Ink-backed React app surface", () => {
  expect(SkyAgentTuiApp).toBeTypeOf("function");
});

test("tui gateway session starts local gateway and returns redacted config", async () => {
  isolatedSkyAgentHome();

  const session = await connectTuiGateway();

  expect(session.gateway.status.running).toBe(true);
  expect(session.gateway.status.url).toStartWith("http://127.0.0.1:");
  expect(session.config.apiKeyConfigured).toBeTypeOf("boolean");
  expect(JSON.stringify(session.gateway.status)).not.toContain("\"token\":");
  expect(JSON.stringify(session.config)).not.toContain("apiKey\":");
});

test("root skyagent script delegates tui smoke mode", async () => {
  const proc = Bun.spawn(["bun", "./scripts/skyagent.ts", "tui", "--smoke"], {
    cwd: path.resolve(import.meta.dir, "../../.."),
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = await new Response(proc.stdout).json();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  expect(exitCode).toBe(0);
  expect(stderr).toBe("");
  expect(stdout.surface).toBe("tui");
  expect(stdout.screens).toContain("profiles");
});
