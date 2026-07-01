import React, { useCallback, useEffect, useState } from "react";
import { Box, Text, render, useApp, useInput } from "ink";
import { publicConfig } from "@skyagent/core";
import { gatewayClient } from "@skyagent/gateway/manager";

type MenuId = "status" | "profiles" | "overview" | "debug" | "advanced";

type TuiState = {
  menuIndex: number;
  profileCursor: number;
  debugCursor: number;
  loading: boolean;
  error: string | null;
  gateway: Awaited<ReturnType<typeof gatewayClient>> | null;
  config: any | null;
  profiles: any[];
  overview: any | null;
  debugResult: unknown;
};

const MENU: Array<{ id: MenuId; label: string }> = [
  { id: "status", label: "Config / status" },
  { id: "profiles", label: "Profile selector" },
  { id: "overview", label: "Profile overview" },
  { id: "debug", label: "Raw API / debug launcher" },
  { id: "advanced", label: "Advanced sections" },
];

const PENDING_SECTIONS = [
  ["Inventory", "available through CLI/MCP; richer TUI screen pending"],
  ["Networth", "available through CLI/MCP; richer TUI screen pending"],
  ["Accessories", "available through CLI/MCP; richer TUI screen pending"],
  ["Progression", "available through CLI/MCP; richer TUI screen pending"],
  ["Readiness", "available through CLI/MCP; richer TUI screen pending"],
  ["Planner", "available through CLI/MCP; richer TUI screen pending"],
];

const DEBUG_ACTIONS = [
  { label: "Gateway version", endpoint: "version" },
  { label: "Gateway config", endpoint: "config" },
  { label: "SkyBlock profiles", endpoint: "profiles" },
  { label: "Selected profile overview", endpoint: "overview" },
];

function boolLabel(value: unknown) {
  return value ? "yes" : "no";
}

function formatCoins(value: unknown) {
  return typeof value === "number" ? Math.round(value).toLocaleString("en-US") : "unknown";
}

function profileLabel(profile: any) {
  const name = profile.cuteName ?? "unnamed";
  const selected = profile.selected ? " selected" : "";
  return `${name} (${profile.profileId})${selected}`;
}

function createState(): TuiState {
  return {
    menuIndex: 0,
    profileCursor: 0,
    debugCursor: 0,
    loading: false,
    error: null,
    gateway: null,
    config: null,
    profiles: [],
    overview: null,
    debugResult: null,
  };
}

function setupGuidance(config: any, needsProfile = false) {
  const missing = [];
  if (!config?.username && !config?.uuid) {
    missing.push("username or UUID");
  }
  if (!config?.apiKeyConfigured) {
    missing.push("Hypixel API key");
  }
  if (needsProfile && !config?.selectedProfileId) {
    missing.push("selected profile");
  }
  return missing.length ? `Setup incomplete: configure ${missing.join(", ")} from the status screen or CLI, then refresh.` : null;
}

export function tuiStatus() {
  const config = publicConfig();
  return {
    surface: "tui",
    renderer: "ink",
    ready: true,
    interactive: Boolean(process.stdin.isTTY && process.stdout.isTTY),
    configured: {
      username: Boolean(config.username),
      uuid: Boolean(config.uuid),
      profile: Boolean(config.selectedProfileId),
      apiKey: Boolean(config.apiKeyConfigured),
    },
    config: {
      username: config.username,
      uuid: config.uuid,
      selectedProfileId: config.selectedProfileId,
      apiKeyConfigured: config.apiKeyConfigured,
      apiKeySource: config.apiKeySource,
      dataDir: config.dataDir,
    },
    providers: {
      hypixelApi: config.apiKeyConfigured ? "configured" : "missing_api_key",
      itemMetadata: "on_demand_neu_provider",
      priceCache: "shared_core_provider_cache",
    },
    gateway: {
      managed: false,
      mode: "not_started_for_status_snapshot",
    },
  };
}

export function tuiSnapshot() {
  const status = tuiStatus();
  return {
    ...status,
    screens: MENU.map((item) => item.id),
    shortcuts: ["up/down or j/k", "left/right or h/l", "enter", "r", "q"],
    secrets: "api keys are never printed",
  };
}

function Header({ title }: { title: string }) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="cyan">SkyAgent</Text>
      <Text bold>{title}</Text>
      <Text dimColor>up/down or j/k screens, left/right or h/l lists, enter select, r refresh, q quit</Text>
    </Box>
  );
}

function Menu({ activeIndex }: { activeIndex: number }) {
  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1} marginTop={1}>
      {MENU.map((item, index) => (
        <Text key={item.id} color={index === activeIndex ? "green" : undefined}>
          {index === activeIndex ? "> " : "  "}{item.label}
        </Text>
      ))}
    </Box>
  );
}

function StatusScreen({ state }: { state: TuiState }) {
  const status = tuiStatus();
  const config = state.config ?? status.config;
  const gateway = state.gateway?.status;
  return (
    <Box flexDirection="column">
      <Header title="Config / status" />
      {state.loading && <Text color="yellow">Connecting to local gateway...</Text>}
      {state.error && <Text color="red">Gateway: {state.error}</Text>}
      <Text>Gateway: {gateway ? `${gateway.url} pid=${gateway.pid}` : "not connected"}</Text>
      <Text>Username: {config.username ?? "not configured"}</Text>
      <Text>UUID: {config.uuid ?? "not configured"}</Text>
      <Text>Selected profile: {config.selectedProfileId ?? "not configured"}</Text>
      <Text>API key configured: {boolLabel(config.apiKeyConfigured)}{config.apiKeySource ? ` (${config.apiKeySource})` : ""}</Text>
      <Text>Data dir: {config.dataDir}</Text>
      <Box flexDirection="column" marginTop={1}>
        <Text bold>Providers / cache</Text>
        <Text>Hypixel API: {config.apiKeyConfigured ? "configured" : "missing_api_key"}</Text>
        <Text>Item metadata: {status.providers.itemMetadata}</Text>
        <Text>Price cache: {status.providers.priceCache}</Text>
      </Box>
    </Box>
  );
}

function ProfilesScreen({ state }: { state: TuiState }) {
  return (
    <Box flexDirection="column">
      <Header title="Profile selector" />
      {state.loading && <Text color="yellow">Loading profiles...</Text>}
      {!state.loading && state.error && (
        <>
          <Text color="red">Error: {state.error}</Text>
          <Text dimColor>Complete setup in Config / status, then press r.</Text>
        </>
      )}
      {!state.loading && !state.error && state.profiles.length === 0 && <Text>No profiles loaded. Press r to fetch profiles.</Text>}
      {!state.loading && !state.error && state.profiles.length > 0 && (
        <>
          <Text dimColor>Select a profile and press enter to store it in SkyAgent config.</Text>
          <Box flexDirection="column" marginTop={1}>
            {state.profiles.map((profile, index) => (
              <Text key={profile.profileId} color={index === state.profileCursor ? "green" : undefined}>
                {index === state.profileCursor ? "> " : "  "}{profileLabel(profile)}
              </Text>
            ))}
          </Box>
        </>
      )}
    </Box>
  );
}

function OverviewScreen({ state }: { state: TuiState }) {
  const overview = state.overview;
  return (
    <Box flexDirection="column">
      <Header title="Profile overview" />
      {state.loading && <Text color="yellow">Loading overview...</Text>}
      {!state.loading && state.error && (
        <>
          <Text color="red">Error: {state.error}</Text>
          <Text dimColor>Complete setup in Config / status, then press r.</Text>
        </>
      )}
      {!state.loading && !state.error && !overview && <Text>No overview loaded. Press r to fetch the selected profile overview.</Text>}
      {!state.loading && !state.error && overview && (
        <Box flexDirection="column">
          <Text>Profile: {overview.selectedProfile.cuteName ?? "unnamed"} ({overview.selectedProfile.profileId})</Text>
          <Text>Game mode: {overview.selectedProfile.gameMode}</Text>
          <Text>Purse: {formatCoins(overview.economy.purse)}</Text>
          <Text>Bank: {formatCoins(overview.economy.bank)}</Text>
          <Text>SkyBlock level XP: {overview.progression.skyblockLevelXp ?? "unknown"}</Text>
          <Text>Skill XP keys: {overview.progression.skillExperienceKeys.length}</Text>
          <Text>Slayer bosses: {overview.progression.slayerBosses.join(", ") || "none"}</Text>
          <Box flexDirection="column" marginTop={1}>
            <Text bold>Inventory API signals</Text>
            {Object.entries(overview.inventoryApiSignals).map(([key, value]) => (
              <Text key={key}>- {key}: {boolLabel(value)}</Text>
            ))}
          </Box>
          {overview.rateLimit && (
            <Text>Rate limit: remaining={overview.rateLimit.remaining ?? "unknown"} reset={overview.rateLimit.reset ?? "unknown"}</Text>
          )}
        </Box>
      )}
    </Box>
  );
}

function DebugScreen({ state }: { state: TuiState }) {
  return (
    <Box flexDirection="column">
      <Header title="Raw API / debug launcher" />
      {state.loading && <Text color="yellow">Running request...</Text>}
      {!state.loading && state.error && <Text color="red">Error: {state.error}</Text>}
      <Text dimColor>Select an endpoint abstraction and press enter.</Text>
      <Box flexDirection="column" marginTop={1}>
        {DEBUG_ACTIONS.map((action, index) => (
          <Text key={action.endpoint} color={index === state.debugCursor ? "green" : undefined}>
            {index === state.debugCursor ? "> " : "  "}{action.label}
          </Text>
        ))}
      </Box>
      {state.debugResult && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Last result</Text>
          <Text>{JSON.stringify(state.debugResult, null, 2)}</Text>
        </Box>
      )}
    </Box>
  );
}

function AdvancedScreen({ state }: { state: TuiState }) {
  const gateway = state.gateway?.status;
  const config = state.config;
  return (
    <Box flexDirection="column">
      <Header title="Advanced sections" />
      {state.loading && <Text color="yellow">Refreshing gateway contract...</Text>}
      {state.error && <Text color="red">Error: {state.error}</Text>}
      <Text>Gateway: {gateway ? `${gateway.url} pid=${gateway.pid}` : "not connected"}</Text>
      <Text>Configured player: {config?.username ?? config?.uuid ?? "not configured"}</Text>
      <Text>Selected profile: {config?.selectedProfileId ?? "not configured"}</Text>
      {PENDING_SECTIONS.map(([name, note]) => (
        <Text key={name}>- {name}: {note}</Text>
      ))}
    </Box>
  );
}

function ActiveScreen({ state }: { state: TuiState }) {
  const active = MENU[state.menuIndex].id;
  if (active === "status") {
    return <StatusScreen state={state} />;
  }
  if (active === "profiles") {
    return <ProfilesScreen state={state} />;
  }
  if (active === "overview") {
    return <OverviewScreen state={state} />;
  }
  if (active === "debug") {
    return <DebugScreen state={state} />;
  }
  return <AdvancedScreen state={state} />;
}

export async function connectTuiGateway() {
  const gateway = await gatewayClient();
  const configResponse = await gateway.client.config();
  return { gateway, config: configResponse.config };
}

export function SkyAgentTuiApp() {
  const { exit } = useApp();
  const [state, setState] = useState<TuiState>(() => createState());

  const patchState = useCallback((patch: Partial<TuiState>) => {
    setState((current) => ({ ...current, ...patch }));
  }, []);

  const connectGateway = useCallback(async () => {
    const session = await connectTuiGateway();
    patchState({ gateway: session.gateway, config: session.config, error: null });
    return session;
  }, [patchState]);

  const loadProfiles = useCallback(async () => {
    patchState({ loading: true, error: null });
    try {
      const { gateway, config } = state.gateway && state.config
        ? { gateway: state.gateway, config: state.config }
        : await connectGateway();
      const guidance = setupGuidance(config);
      if (guidance) {
        patchState({ error: guidance, loading: false });
        return;
      }
      const response = await gateway.client.profiles();
      const profiles = response.profiles ?? [];
      const selectedIndex = profiles.findIndex((profile) => profile.profileId === config.selectedProfileId || profile.selected);
      patchState({ profiles, profileCursor: Math.max(0, selectedIndex), loading: false });
    } catch (error) {
      patchState({ error: error instanceof Error ? error.message : String(error), loading: false });
    }
  }, [connectGateway, patchState, state.config, state.gateway]);

  const loadOverview = useCallback(async () => {
    patchState({ loading: true, error: null });
    try {
      const { gateway, config } = state.gateway && state.config
        ? { gateway: state.gateway, config: state.config }
        : await connectGateway();
      const guidance = setupGuidance(config, true);
      if (guidance) {
        patchState({ error: guidance, loading: false });
        return;
      }
      const response = await gateway.client.overview();
      patchState({ overview: response.overview, loading: false });
    } catch (error) {
      patchState({ error: error instanceof Error ? error.message : String(error), loading: false });
    }
  }, [connectGateway, patchState, state.config, state.gateway]);

  const runDebugAction = useCallback(async () => {
    const action = DEBUG_ACTIONS[state.debugCursor];
    patchState({ loading: true, error: null, debugResult: null });
    try {
      const { gateway, config } = state.gateway && state.config
        ? { gateway: state.gateway, config: state.config }
        : await connectGateway();
      const guidance = action.endpoint === "profiles"
        ? setupGuidance(config)
        : action.endpoint === "overview"
          ? setupGuidance(config, true)
          : null;
      if (guidance) {
        patchState({ error: guidance, loading: false });
        return;
      }
      const response = action.endpoint === "version"
        ? await gateway.client.version()
        : action.endpoint === "config"
          ? await gateway.client.config()
          : action.endpoint === "profiles"
            ? await gateway.client.profiles()
            : await gateway.client.overview();
      patchState({
        loading: false,
        debugResult: {
          endpoint: action.endpoint,
          keys: response && typeof response === "object" ? Object.keys(response) : [],
          response,
        },
      });
    } catch (error) {
      patchState({ error: error instanceof Error ? error.message : String(error), loading: false });
    }
  }, [connectGateway, patchState, state.config, state.debugCursor, state.gateway]);

  const refreshActive = useCallback(async () => {
    const active = MENU[state.menuIndex].id;
    if (active === "profiles") {
      await loadProfiles();
    } else if (active === "overview") {
      await loadOverview();
    } else if (active === "status" || active === "advanced") {
      patchState({ loading: true, error: null });
      try {
        await connectGateway();
        patchState({ loading: false });
      } catch (error) {
        patchState({ error: error instanceof Error ? error.message : String(error), loading: false });
      }
    }
  }, [connectGateway, loadOverview, loadProfiles, patchState, state.menuIndex]);

  const selectActive = useCallback(async () => {
    const active = MENU[state.menuIndex].id;
    if (active === "profiles" && state.profiles[state.profileCursor]) {
      patchState({ loading: true, error: null });
      try {
        const { gateway } = state.gateway && state.config
          ? { gateway: state.gateway }
          : await connectGateway();
        const selectedProfileId = state.profiles[state.profileCursor].profileId;
        const configResponse = await gateway.client.setConfig({ selectedProfileId });
        const overviewResponse = await gateway.client.overview();
        patchState({
          config: configResponse.config,
          overview: overviewResponse.overview,
          loading: false,
          menuIndex: MENU.findIndex((item) => item.id === "overview"),
        });
      } catch (error) {
        patchState({ error: error instanceof Error ? error.message : String(error), loading: false });
      }
    } else if (active === "debug") {
      await runDebugAction();
    } else {
      await refreshActive();
    }
  }, [connectGateway, patchState, refreshActive, runDebugAction, state.config, state.gateway, state.menuIndex, state.profileCursor, state.profiles]);

  useInput((input, key) => {
    if (state.loading) {
      return;
    }
    if (input === "q" || (key.ctrl && input === "c")) {
      exit();
      return;
    }
    if (key.upArrow || input === "k") {
      setState((current) => ({ ...current, menuIndex: (current.menuIndex - 1 + MENU.length) % MENU.length }));
    } else if (key.downArrow || input === "j") {
      setState((current) => ({ ...current, menuIndex: (current.menuIndex + 1) % MENU.length }));
    } else if (key.leftArrow || input === "h") {
      setState((current) => {
        const active = MENU[current.menuIndex].id;
        if (active === "profiles" && current.profiles.length) {
          return { ...current, profileCursor: (current.profileCursor - 1 + current.profiles.length) % current.profiles.length };
        }
        if (active === "debug") {
          return { ...current, debugCursor: (current.debugCursor - 1 + DEBUG_ACTIONS.length) % DEBUG_ACTIONS.length };
        }
        return current;
      });
    } else if (key.rightArrow || input === "l") {
      setState((current) => {
        const active = MENU[current.menuIndex].id;
        if (active === "profiles" && current.profiles.length) {
          return { ...current, profileCursor: (current.profileCursor + 1) % current.profiles.length };
        }
        if (active === "debug") {
          return { ...current, debugCursor: (current.debugCursor + 1) % DEBUG_ACTIONS.length };
        }
        return current;
      });
    } else if (key.return) {
      void selectActive();
    } else if (input === "r") {
      void refreshActive();
    }
  });

  useEffect(() => {
    const active = MENU[state.menuIndex].id;
    if (active === "status") {
      patchState({ error: null });
    }
  }, [patchState, state.menuIndex]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      patchState({ loading: true, error: null });
      try {
        const session = await connectTuiGateway();
        if (!cancelled) {
          patchState({ gateway: session.gateway, config: session.config, loading: false });
        }
      } catch (error) {
        if (!cancelled) {
          patchState({ error: error instanceof Error ? error.message : String(error), loading: false });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [patchState]);

  return (
    <Box flexDirection="column" paddingX={1}>
      <ActiveScreen state={state} />
      <Menu activeIndex={state.menuIndex} />
    </Box>
  );
}

export async function runInteractiveTui() {
  const instance = render(<SkyAgentTuiApp />);
  await instance.waitUntilExit();
}

export async function runTui(args = process.argv.slice(2)) {
  if (args.includes("--smoke") || !process.stdin.isTTY || !process.stdout.isTTY) {
    process.stdout.write(`${JSON.stringify(tuiSnapshot(), null, 2)}\n`);
    return;
  }
  await runInteractiveTui();
}
