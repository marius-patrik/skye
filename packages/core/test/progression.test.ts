import { describe, expect, test } from "bun:test";
import { CATACOMBS_XP_THRESHOLDS, SKILL_XP_THRESHOLDS, catacombsLevelFromXp, progressionFromContext, skillLevelFromXp, slayerLevelFromXp } from "../src/index.ts";

describe("XP curves", () => {
  test("calculates skill XP boundaries", () => {
    expect(skillLevelFromXp(0)).toMatchObject({ level: 0, nextLevelXp: SKILL_XP_THRESHOLDS[1] });
    expect(skillLevelFromXp(50)).toMatchObject({ level: 1, currentLevelXp: 50 });
    expect(skillLevelFromXp(SKILL_XP_THRESHOLDS[10] - 1)).toMatchObject({ level: 9 });
    expect(skillLevelFromXp(SKILL_XP_THRESHOLDS[10])).toMatchObject({ level: 10 });
  });

  test("calculates catacombs XP boundaries", () => {
    expect(catacombsLevelFromXp(CATACOMBS_XP_THRESHOLDS[5] - 1)).toMatchObject({ level: 4 });
    expect(catacombsLevelFromXp(CATACOMBS_XP_THRESHOLDS[5])).toMatchObject({ level: 5 });
  });

  test("calculates slayer XP thresholds", () => {
    expect(slayerLevelFromXp(4)).toMatchObject({ level: 0 });
    expect(slayerLevelFromXp(5)).toMatchObject({ level: 1 });
    expect(slayerLevelFromXp(1_000_000)).toMatchObject({ level: 9 });
  });
});

describe("progression sections", () => {
  test("renders deterministic basic progression sections", () => {
    const result = progressionFromContext({
      uuid: "player-uuid",
      profile: {
        profile_id: "profile-id",
        cute_name: "Apple",
        banking: { balance: 123 },
      },
      member: {
        currencies: { coin_purse: 456, essence: { WITHER: 7 } },
        player_data: {
          experience: {
            SKILL_FARMING: SKILL_XP_THRESHOLDS[10],
            SKILL_MINING: 50,
          },
          unlocked_coll_tiers: ["WHEAT_1"],
        },
        collection: {
          WHEAT: 100,
        },
        slayer: {
          slayer_bosses: {
            zombie: { xp: 1_000, claimed_levels: { level_1: true } },
          },
        },
        dungeons: {
          dungeon_types: {
            catacombs: { experience: CATACOMBS_XP_THRESHOLDS[5] },
          },
          player_classes: {
            mage: { experience: CATACOMBS_XP_THRESHOLDS[3] },
          },
        },
      },
      rateLimit: { remaining: 10 },
    });

    expect(result.sections.map((section) => section.section)).toEqual(["skills", "dungeons", "slayer", "collections", "currencies"]);
    expect(result.sections.find((section) => section.section === "skills")?.computed.skillAverage).toBe(5.5);
    expect(result.sections.find((section) => section.section === "dungeons")?.computed.catacombs.level).toBe(5);
    expect(result.sections.find((section) => section.section === "slayer")?.computed.bosses.zombie.level).toBe(4);
    expect(result.sections.find((section) => section.section === "currencies")?.computed).toMatchObject({ purse: 456, bank: 123 });
  });
});
