export const ACTIONS = Object.freeze({
  recruit: { name: "招募", icon: "📣" },
  practice: { name: "練習", icon: "🎯" },
  event: { name: "活動籌備", icon: "🎪" },
  proposal: { name: "企劃撰寫", icon: "📝" },
  upkeep: { name: "器材保養", icon: "🧰" },
});

export const VENUES = Object.freeze({
  gym: { name: "風雨球場", fit: { tournament: 3, showcase: 1, workshop: 0 } },
  auditorium: { name: "大禮堂", fit: { tournament: 0, showcase: 3, workshop: 1 } },
  lab: { name: "創客教室", fit: { tournament: 0, showcase: 1, workshop: 3 } },
  classroom: { name: "普通教室", fit: { tournament: 1, showcase: 1, workshop: 2 } },
  courtyard: { name: "中庭角落", fit: { tournament: 1, showcase: 2, workshop: 0 } },
});

export const EVENT_TYPES = Object.freeze({
  showcase: { name: "成果展", cost: 12 },
  tournament: { name: "交流賽", cost: 14 },
  workshop: { name: "體驗坊", cost: 10 },
});

const WEEKLY_EVENTS = [
  { id: "welcome", name: "新生探索週", tip: "校園裡到處是想找社團的新同學。", recruit: 2 },
  { id: "rain", name: "梅雨警報", tip: "室外場地難度上升，器材保養更重要。", safety: -1 },
  { id: "artsFest", name: "藝文季", tip: "成果展順風，觀眾願意停下腳步。", showcase: 2 },
  { id: "sportsWeek", name: "校慶運動週", tip: "交流賽全校矚目。", tournament: 2 },
  { id: "examRush", name: "期中地獄", tip: "大家行程爆滿，活動更難揪人。", turnout: -2 },
  { id: "makerDay", name: "創客日", tip: "體驗坊特別吸睛。", workshop: 2 },
  { id: "sponsor", name: "校友返校", tip: "好成果可帶來額外贊助。", finance: 1 },
  { id: "finale", name: "社團博覽會", tip: "最後一週，所有努力都會被看見。", turnout: 2 },
];

function hash(seed, salt) {
  let value = (Number(seed) ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x21f0aaad);
  value ^= value >>> 15;
  return (Math.imul(value, 0x735a2d97) ^ (value >>> 15)) >>> 0;
}

function random01(seed, salt = 0) {
  return hash(seed, salt) / 0x100000000;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function makeClub(id, name, style, overrides = {}) {
  return {
    id,
    name,
    style,
    budget: 68,
    members: 18,
    interest: 5,
    satisfaction: 6,
    prestige: 4,
    proposal: 2,
    practice: 1,
    prep: 1,
    gear: 6,
    safety: 6,
    outcomes: 0,
    participation: 0,
    eventsHeld: 0,
    ...overrides,
  };
}

export function createGame({ seed = Date.now(), clubName = "放學後研究社" } = {}) {
  const safeSeed = Number(seed) >>> 0;
  return {
    seed: safeSeed,
    week: 1,
    maxWeeks: 8,
    phase: "planning",
    weeklyEvent: WEEKLY_EVENTS[0],
    clubs: [
      makeClub("player", clubName, "player"),
      makeClub("ai-spark", "閃耀熱舞社", "showcase", { prestige: 6, members: 22 }),
      makeClub("ai-craft", "萬用創客社", "workshop", { proposal: 5, budget: 62 }),
      makeClub("ai-sport", "不服來賽社", "tournament", { practice: 3, gear: 7 }),
    ],
    history: [],
    lastReport: null,
    ranking: null,
  };
}

export function validatePlan(plan) {
  if (!plan || !plan.work) throw new Error("請分配幹部工作點");
  const values = Object.keys(ACTIONS).map((key) => plan.work[key]);
  if (values.some((value) => !Number.isInteger(value))) throw new Error("工作點必須是整數");
  if (values.some((value) => value < 0 || value > 3)) throw new Error("每項工作點需為 0～3");
  if (values.reduce((sum, value) => sum + value, 0) !== 3) throw new Error("每週必須剛好分配 3 點");
  if (!VENUES[plan.venue]) throw new Error("請選擇申請場地");
  if (!EVENT_TYPES[plan.eventType]) throw new Error("請選擇活動類型");
  if (typeof plan.useSecondary !== "boolean") throw new Error("備選場地設定無效");
  return true;
}

export function allocateVenues(clubs, plans, seed, week) {
  const applications = new Map();
  clubs.forEach((club, index) => {
    const venue = plans[index].venue;
    const score = club.prestige + club.proposal + (plans[index].work?.proposal ?? 0) * 1.5;
    const tie = random01(seed + week, index + venue.length);
    const list = applications.get(venue) ?? [];
    list.push({ club, score, tie, plan: plans[index] });
    applications.set(venue, list);
  });

  const result = {};
  for (const [venue, entries] of applications) {
    entries.sort((a, b) => b.score - a.score || b.tie - a.tie || a.club.id.localeCompare(b.club.id));
    entries.forEach((entry, index) => {
      if (index === 0) {
        result[entry.club.id] = { venue, secondary: false, score: entry.score };
      } else if (entry.plan.useSecondary) {
        const options = Object.keys(VENUES).filter((key) => key !== venue);
        const secondaryVenue = options[hash(seed + week, entry.club.id.length + index) % options.length];
        result[entry.club.id] = { venue: secondaryVenue, secondary: true, score: entry.score };
      } else {
        result[entry.club.id] = { venue: null, secondary: false, score: entry.score };
      }
    });
  }
  return result;
}

export function applyMemberFlow(club, work, roll = 0.5, weeklyEvent = {}) {
  const weeklyRecruit = weeklyEvent.recruit ?? 0;
  const recruitBoost = work.recruit * 1.6 + weeklyRecruit;
  const joined = Math.max(0, Math.floor(club.interest * 0.42 + recruitBoost + roll * 2 - 1));
  const left = Math.max(0, Math.floor((5 - club.satisfaction) * 0.55 + (work.recruit === 0 ? 0.7 : 0)));
  return {
    members: Math.max(5, club.members + joined - left),
    interest: clamp(club.interest + work.recruit * 1.4 - joined * 0.45 + weeklyRecruit * 0.5, 0, 10),
    joined,
    left,
  };
}

export function eventSuccess(input) {
  const venueFit = input.venue ? (VENUES[input.venue]?.fit[input.eventType] ?? 0) : -3;
  const weeklyFit = input.weeklyEvent
    ? (typeof input.weeklyEvent === "string"
        ? input.weeklyEvent === "sportsWeek" && input.eventType === "tournament"
          ? 2
          : input.weeklyEvent === "examRush"
            ? -2
            : 0
        : (input.weeklyEvent[input.eventType] ?? 0) + (input.weeklyEvent.turnout ?? 0))
    : 0;
  const safetyFactor = Math.min(input.safety + input.upkeep, 8) * 0.35;
  const luck = random01(input.seed, input.week * 17 + input.eventType.length) * 3 - 1.5;
  const score = clamp(
    2 + input.prep * 1.25 + input.practice * 0.72 + venueFit * 1.4 + weeklyFit + safetyFactor + luck,
    0,
    20,
  );
  return {
    score: Math.round(score * 10) / 10,
    venueFit,
    weeklyFit,
    success: score >= 10,
    label: score >= 15 ? "全校轟動" : score >= 10 ? "順利成功" : score >= 6 ? "勉強完成" : "現場翻車",
  };
}

export function evaluateClub(metrics) {
  const weights = { participation: 0.3, outcomes: 0.3, finance: 0.2, safety: 0.2 };
  const normalized = Object.fromEntries(
    Object.keys(weights).map((key) => [key, clamp(Number(metrics[key]) || 0, 0, 10)]),
  );
  const raw = Math.round(
    Object.entries(weights).reduce((total, [key, weight]) => total + normalized[key] * weight * 10, 0),
  );
  const cappedBy = Object.keys(weights).filter((key) => normalized[key] < 3);
  const caution = Object.keys(weights).filter((key) => normalized[key] >= 3 && normalized[key] < 5);
  const cap = cappedBy.length ? 49 : caution.length ? 69 : 100;
  return { ...normalized, raw, overall: Math.min(raw, cap), cappedBy, caution };
}

export function aiPlan(club, weeklyEvent = {}, seed = 1) {
  const primary =
    club.style === "showcase" ? "event" : club.style === "workshop" ? "proposal" : "practice";
  const work = { recruit: 0, practice: 0, event: 0, proposal: 0, upkeep: 0 };
  work[primary] = 1;
  work[club.members < 18 || weeklyEvent.id === "welcome" ? "recruit" : "event"] += 1;
  work[club.gear < 5 || weeklyEvent.id === "rain" ? "upkeep" : "proposal"] += 1;
  const venue =
    club.style === "showcase" ? "auditorium" : club.style === "workshop" ? "lab" : "gym";
  const eventType =
    club.style === "showcase" ? "showcase" : club.style === "workshop" ? "workshop" : "tournament";
  const alternateVenues = ["gym", "auditorium", "lab"];
  return {
    work,
    venue: random01(seed, club.id.length) < 0.2 ? alternateVenues[hash(seed, club.id.length) % 3] : venue,
    eventType,
    useSecondary: true,
  };
}

function resolveClub(club, plan, assignment, game, index) {
  const work = plan.work;
  const flow = applyMemberFlow(club, work, random01(game.seed + game.week, index), game.weeklyEvent);
  const cost = EVENT_TYPES[plan.eventType].cost + work.recruit * 2 + work.upkeep * 2;
  const affordable = club.budget >= cost;
  const event = eventSuccess({
    seed: game.seed + index * 41,
    week: game.week,
    prep: club.prep + work.event,
    practice: club.practice + work.practice,
    venue: assignment.venue,
    eventType: plan.eventType,
    weeklyEvent: game.weeklyEvent,
    safety: club.safety,
    upkeep: work.upkeep,
  });
  const held = affordable && Boolean(assignment.venue);
  const effectiveScore = held ? event.score : 0;
  const attendance = held
    ? Math.max(2, Math.round(flow.members * (0.35 + effectiveScore / 22) + (game.weeklyEvent.turnout ?? 0)))
    : 0;
  const income = held ? Math.round(attendance * 0.55 + (event.success ? 7 : 1)) : 0;
  const budget = club.budget - (affordable ? cost : 0) + income;
  const gear = clamp(club.gear + work.upkeep * 1.5 - (held ? 0.8 : 0), 0, 10);
  const safety = clamp(club.safety + work.upkeep * 0.8 - (held && gear < 4 ? 1.5 : 0) + (game.weeklyEvent.safety ?? 0), 0, 10);
  const satisfaction = clamp(club.satisfaction + (event.success ? 0.7 : held ? -0.2 : -0.8) + work.practice * 0.25, 0, 10);
  const prestige = clamp(club.prestige + (event.success ? 0.65 : held ? 0.1 : -0.2), 0, 10);
  const next = {
    ...club,
    budget,
    members: flow.members,
    interest: clamp(flow.interest + (event.success ? 1 : 0), 0, 10),
    satisfaction,
    prestige,
    proposal: clamp(club.proposal * 0.65 + work.proposal * 1.5, 0, 10),
    practice: clamp(club.practice * 0.7 + work.practice * 1.4, 0, 10),
    prep: clamp(club.prep * 0.6 + work.event * 1.5, 0, 10),
    gear,
    safety,
    outcomes: club.outcomes + effectiveScore,
    participation: club.participation + attendance,
    eventsHeld: club.eventsHeld + (held ? 1 : 0),
  };
  return {
    club: next,
    report: { id: club.id, plan, assignment, event, held, attendance, cost: affordable ? cost : 0, income, joined: flow.joined, left: flow.left },
  };
}

function finalEvaluation(club) {
  const metrics = {
    participation: clamp((club.participation / 85) * 10, 0, 10),
    outcomes: clamp((club.outcomes / 105) * 10, 0, 10),
    finance: clamp((club.budget / 85) * 10, 0, 10),
    safety: club.safety,
  };
  return evaluateClub(metrics);
}

export function resolveWeek(game, playerPlan) {
  if (game.phase !== "planning") throw new Error("學期已經結束");
  validatePlan(playerPlan);
  const plans = [
    playerPlan,
    ...game.clubs.slice(1).map((club, index) => aiPlan(club, game.weeklyEvent, game.seed + game.week + index)),
  ];
  plans.forEach(validatePlan);
  const assignments = allocateVenues(game.clubs, plans, game.seed, game.week);
  const resolved = game.clubs.map((club, index) =>
    resolveClub(club, plans[index], assignments[club.id], game, index),
  );
  const reports = Object.fromEntries(resolved.map(({ report }) => [report.id, report]));
  const lastReport = { week: game.week, event: game.weeklyEvent, assignments, reports, player: reports.player };
  const clubs = resolved.map(({ club }) => club);
  const ended = game.week >= game.maxWeeks;
  const ranking = ended
    ? clubs
        .map((club) => ({ ...club, evaluation: finalEvaluation(club) }))
        .sort((a, b) => b.evaluation.overall - a.evaluation.overall || b.budget - a.budget)
    : null;
  return {
    ...game,
    week: ended ? game.week : game.week + 1,
    phase: ended ? "ended" : "planning",
    weeklyEvent: ended ? game.weeklyEvent : WEEKLY_EVENTS[game.week],
    clubs,
    history: [...game.history, lastReport],
    lastReport,
    ranking,
  };
}
