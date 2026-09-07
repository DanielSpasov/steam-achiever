// Heuristic: does an achievement's text point at online / competitive play,
// where granting it manually is more likely to be noticed or against the rules?
// Advisory only and tuned for precision. Words like "guild", "raid" and "season"
// are left out on purpose because they fire constantly on single-player RPGs.

const PATTERNS: RegExp[] = [
  /\bonline\b/i,
  /\bmulti[\s-]?player\b/i,
  /\bco[\s-]?op(?:erative)?\b/i,
  /\branked\b/i,
  /\bcompetitive\b/i,
  /\bmatchmaking\b/i,
  /\bmatchmade\b/i,
  /\bmatchmaker\b/i,
  /\bversus\s+(?:mode|match|another)\b/i,
  /\bpv[ep]\b/i,
  /\bplayer[\s-]?(?:vs\.?|versus)[\s-]?player\b/i,
  /\bdeathmatch\b/i,
  /\bleaderboard/i,
  /\bmmr\b/i,
  /\belo\b/i,
  /\bmvp\b/i,
  /\b(?:win|complete)\s+(?:\d+\s+)?(?:an?\s+|your\s+)?(?:online|ranked|competitive|multiplayer|versus|pvp)\s+(?:match|matches|game|games|round|rounds)\b/i,
  /\b(?:kill|defeat|beat)\s+(?:\d+\s+)?(?:other\s+|enemy\s+|real\s+)?players\b/i,
  /\bagainst\s+(?:\d+\s+)?(?:other\s+|real\s+|human\s+)?players\b/i,
];

export function isRiskyAchievement(displayName: string, description: string): boolean {
  const text = `${displayName}. ${description}`;
  return PATTERNS.some((re) => re.test(text));
}
