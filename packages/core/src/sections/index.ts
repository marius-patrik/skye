import { fetchProfileContext } from "../profile.ts";
import { CATACOMBS_XP_THRESHOLDS, SKILL_NAMES, RARITY_ORDER, catacombsLevelFromXp, normalizeSectionName, skillLevelFromXp, slayerLevelFromXp } from "../progression.ts";

function keys(value: any) {
  return value && typeof value === "object" ? Object.keys(value) : [];
}

function sectionResult(name: string, sourceFields: string[], computed: Record<string, any>, warnings: any[] = []) {
  return {
    section: name,
    sourceFields,
    computed,
    warnings,
    provenance: {
      source: "Hypixel profile member",
      formulas: ["skyagent-progress-parser"],
    },
  };
}

export function skillsSection(member: any) {
  const experience = member?.player_data?.experience ?? {};
  const skills = SKILL_NAMES.map((name) => {
    const key = `SKILL_${name.toUpperCase()}`;
    return {
      name,
      key,
      ...skillLevelFromXp(experience[key] ?? 0),
    };
  });
  const leveled = skills.filter((skill) => skill.xp > 0);
  return sectionResult("skills", ["member.player_data.experience"], {
    skills,
    skillAverage: leveled.length ? Math.round((leveled.reduce((total, skill) => total + skill.level, 0) / leveled.length) * 100) / 100 : 0,
  });
}

export function dungeonsSection(member: any) {
  const dungeons = member?.dungeons ?? {};
  const catacombsXp = dungeons?.dungeon_types?.catacombs?.experience ?? 0;
  const classes = dungeons?.player_classes ?? {};
  return sectionResult("dungeons", ["member.dungeons"], {
    catacombs: catacombsLevelFromXp(catacombsXp),
    classes: Object.fromEntries(Object.entries(classes).map(([name, value]: [string, any]) => [
      name,
      catacombsLevelFromXp(value?.experience ?? 0),
    ])),
    dungeonTypes: keys(dungeons.dungeon_types),
  });
}

export function slayerSection(member: any) {
  const bosses = member?.slayer?.slayer_bosses ?? {};
  return sectionResult("slayer", ["member.slayer.slayer_bosses"], {
    bosses: Object.fromEntries(Object.entries(bosses).map(([name, value]: [string, any]) => [
      name,
      {
        claimedLevels: value?.claimed_levels ?? {},
        ...slayerLevelFromXp(value?.xp ?? 0),
      },
    ])),
  });
}

export function collectionsSection(member: any) {
  return sectionResult("collections", ["member.collection", "member.player_data.unlocked_coll_tiers"], {
    collectionKeys: keys(member?.collection),
    unlockedCollectionTiers: member?.player_data?.unlocked_coll_tiers ?? member?.unlocked_coll_tiers ?? [],
  });
}

export function currenciesSection(member: any, profile: any) {
  const currencies = member?.currencies ?? {};
  return sectionResult("currencies", ["member.currencies", "profile.banking.balance"], {
    purse: currencies.coin_purse ?? member?.coin_purse ?? null,
    bank: profile?.banking?.balance ?? null,
    essenceKeys: keys(currencies.essence),
  });
}

export const SECTION_BUILDERS = {
  skills: skillsSection,
  dungeons: dungeonsSection,
  slayer: slayerSection,
  collections: collectionsSection,
  currencies: currenciesSection,
};

export function sectionNames() {
  return Object.keys(SECTION_BUILDERS);
}

export function profileSectionFromContext(context: any, sectionName: string) {
  const normalized = normalizeSectionName(sectionName);
  const builder = SECTION_BUILDERS[normalized];
  if (!builder) {
    throw new Error(`Unsupported profile section: ${sectionName}. Supported sections: ${sectionNames().join(", ")}`);
  }
  return {
    uuid: context.uuid,
    profile: {
      profileId: context.profile.profile_id,
      cuteName: context.profile.cute_name ?? null,
    },
    rateLimit: context.rateLimit,
    ...builder(context.member, context.profile),
  };
}

export async function profileSectionForPlayer(sectionName: string, player?: string, profile?: string) {
  return profileSectionFromContext(await fetchProfileContext(player, profile), sectionName);
}

export function progressionFromContext(context: any) {
  return {
    uuid: context.uuid,
    profile: {
      profileId: context.profile.profile_id,
      cuteName: context.profile.cute_name ?? null,
    },
    sections: sectionNames().map((name) => profileSectionFromContext(context, name)),
    tables: {
      rarityOrder: RARITY_ORDER,
      catacombsMaxLevel: CATACOMBS_XP_THRESHOLDS.length - 1,
    },
    rateLimit: context.rateLimit,
  };
}

export async function progressionForPlayer(player?: string, profile?: string) {
  return progressionFromContext(await fetchProfileContext(player, profile));
}
