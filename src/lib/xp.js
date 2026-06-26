// XP awards for different actions
export const XP_REWARDS = {
  EASY_SOLVED:      10,
  MEDIUM_SOLVED:    25,
  HARD_SOLVED:      60,
  DAILY_CHALLENGE:  50,  // bonus for solving daily challenge
  INTERVIEW_PASS:   30,  // interview session score >= 70
  VOICE_INTERVIEW:  20,
  STREAK_7:        100,
  STREAK_30:       500,
};

// XP thresholds for levels
const LEVELS = [
  { level: 1,  xp: 0,     title: "Newcomer"     },
  { level: 2,  xp: 100,   title: "Beginner"     },
  { level: 3,  xp: 250,   title: "Learner"      },
  { level: 4,  xp: 500,   title: "Practitioner" },
  { level: 5,  xp: 900,   title: "Developer"    },
  { level: 6,  xp: 1400,  title: "Engineer"     },
  { level: 7,  xp: 2000,  title: "Senior Dev"   },
  { level: 8,  xp: 3000,  title: "Tech Lead"    },
  { level: 9,  xp: 4500,  title: "Architect"    },
  { level: 10, xp: 7000,  title: "Staff Eng"    },
];

export function getLevel(totalXp) {
  let current = LEVELS[0];
  for (const l of LEVELS) {
    if (totalXp >= l.xp) current = l;
    else break;
  }
  const nextLevel = LEVELS[LEVELS.indexOf(current) + 1] || null;
  const progress = nextLevel
    ? Math.round(((totalXp - current.xp) / (nextLevel.xp - current.xp)) * 100)
    : 100;
  return { ...current, nextLevel, progress, totalXp };
}

/**
 * Award XP to a user.
 * Inserts a log row + increments total_xp on profiles (non-blocking).
 */
export async function awardXP(supabase, userId, amount, reason) {
  if (!supabase || !userId || amount <= 0) return;
  try {
    await Promise.all([
      supabase.from("xp_log").insert({ user_id: userId, amount, reason }),
      supabase.from("profiles").upsert(
        { user_id: userId, total_xp: amount },
        { onConflict: "user_id", ignoreDuplicates: false }
      ),
    ]);
  } catch (e) {
    console.error("[awardXP]", e);
  }
}

// Company → relevant topics mapping for readiness score
export const COMPANY_TOPICS = {
  Google:    ["Arrays & Hashing", "Dynamic Programming", "Graphs", "Trees & Recursion", "Bit Manipulation"],
  Meta:      ["Arrays & Hashing", "Trees & Recursion", "Graphs", "Dynamic Programming", "Backtracking"],
  Amazon:    ["Arrays & Hashing", "Trees & Recursion", "Dynamic Programming", "Graphs", "Greedy"],
  Microsoft: ["Arrays & Hashing", "Trees & Recursion", "Dynamic Programming", "Backtracking", "Bit Manipulation"],
  Apple:     ["Arrays & Hashing", "Trees & Recursion", "Graphs", "Dynamic Programming", "Greedy"],
  Netflix:   ["Arrays & Hashing", "Dynamic Programming", "Graphs", "Trees & Recursion", "Backtracking"],
  Uber:      ["Arrays & Hashing", "Graphs", "Dynamic Programming", "Trees & Recursion", "Greedy"],
  Stripe:    ["Arrays & Hashing", "Dynamic Programming", "Trees & Recursion", "Bit Manipulation", "Backtracking"],
};

/**
 * Calculate readiness % for each company based on solved topics.
 * solvedByTopic: { [topicName]: { solved: number, total: number } }
 */
export function calcCompanyReadiness(solvedByTopic) {
  return Object.entries(COMPANY_TOPICS).map(([company, topics]) => {
    const scores = topics.map(t => {
      const d = solvedByTopic[t];
      if (!d || d.total === 0) return 0;
      return Math.min(100, Math.round((d.solved / d.total) * 100));
    });
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    return { company, readiness: avg, topics, scores };
  }).sort((a, b) => b.readiness - a.readiness);
}
