import { describe, expect, test } from "bun:test";
import { CATACOMBS_XP_THRESHOLDS, GARDEN_XP_THRESHOLDS, HOTM_XP_THRESHOLDS, SKILL_XP_THRESHOLDS, readinessFromContext, weightFromContext } from "../src/index.ts";

function fixtureContext() {
  return {
    uuid: "player-uuid",
    profile: {
      profile_id: "profile-id",
      cute_name: "Apple",
    },
    member: {
      player_data: {
        experience: {
          SKILL_FARMING: SKILL_XP_THRESHOLDS[30],
          SKILL_MINING: SKILL_XP_THRESHOLDS[35],
          SKILL_COMBAT: SKILL_XP_THRESHOLDS[25],
        },
      },
      dungeons: {
        dungeon_types: {
          catacombs: {
            experience: CATACOMBS_XP_THRESHOLDS[24],
            tier_completions: { 7: 1 },
          },
        },
        player_classes: {
          mage: { experience: CATACOMBS_XP_THRESHOLDS[20] },
        },
      },
      slayer: {
        slayer_bosses: {
          zombie: { xp: 100_000 },
          spider: { xp: 20_000 },
          wolf: { xp: 5_000 },
        },
      },
      mining_core: {
        experience: HOTM_XP_THRESHOLDS[6],
        powder_mithril: 1_000_000,
        powder_spent_mithril: 1_000_000,
        powder_gemstone: 1_000_000,
        powder_spent_gemstone: 1_000_000,
        nodes: { efficient_miner: 40 },
      },
      garden_player_data: {
        garden_experience: GARDEN_XP_THRESHOLDS[9],
        crop_milestones: {
          wheat: 10,
          carrot: 8,
          potato: 7,
          pumpkin: 6,
          melon: 5,
        },
      },
      nether_island_player_data: {
        kuudra_completed_tiers: { basic: 1 },
        dojo: { belt: "GREEN" },
      },
    },
    rateLimit: { remaining: 10 },
  };
}

describe("weight", () => {
  test("returns explicit unsupported exact formula status plus a labeled estimate", () => {
    const result = weightFromContext(fixtureContext());

    expect(result.status).toBe("estimate");
    expect(result.styles.senither).toMatchObject({ status: "unsupported" });
    expect(result.styles.lily).toMatchObject({ status: "unsupported" });
    expect(result.styles.skyagentEstimate.score).toBeGreaterThan(0);
    expect(result.styles.skyagentEstimate.components.map((component) => component.name)).toEqual(["skills", "dungeons", "slayer", "mining", "garden"]);
    expect(result.warnings.some((entry) => entry.code === "unsupported_formula")).toBe(true);
    expect(result.formulas).toContain("skyagent-weight-estimate-v1");
  });

  test("surfaces missing data instead of inventing exact weight", () => {
    const result = weightFromContext({
      uuid: "player-uuid",
      profile: { profile_id: "profile-id" },
      member: {},
      rateLimit: null,
    });

    expect(result.styles.senither.status).toBe("unsupported");
    expect(result.warnings.filter((entry) => entry.code === "missing_api_data").length).toBeGreaterThan(0);
  });
});

describe("readiness", () => {
  test("scores implemented readiness areas from deterministic fixture data", () => {
    const context = fixtureContext();

    expect(readinessFromContext(context, "dungeons")).toMatchObject({ area: "dungeons", rating: "ready", status: "estimate" });
    expect(readinessFromContext(context, "slayer")).toMatchObject({ area: "slayer", rating: "ready", status: "estimate" });
    expect(readinessFromContext(context, "kuudra")).toMatchObject({ area: "kuudra", rating: "ready", status: "estimate" });
    expect(readinessFromContext(context, "garden")).toMatchObject({ area: "garden", rating: "ready", status: "estimate" });
    expect(readinessFromContext(context, "mining")).toMatchObject({ area: "mining", rating: "ready", status: "estimate" });
  });

  test("supports Crimson Isle aliases for Kuudra readiness", () => {
    expect(readinessFromContext(fixtureContext(), "crimson_isle").area).toBe("kuudra");
  });

  test("returns unknown readiness when required API data is missing", () => {
    const result = readinessFromContext({
      uuid: "player-uuid",
      profile: { profile_id: "profile-id" },
      member: {},
      rateLimit: null,
    }, "mining");

    expect(result.rating).toBe("unknown");
    expect(result.warnings[0]).toMatchObject({ code: "missing_api_data" });
  });
});
