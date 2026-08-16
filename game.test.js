import { describe, expect, it } from "vitest";
import {
  ACTIONS,
  aiPlan,
  allocateVenues,
  applyMemberFlow,
  createGame,
  evaluateClub,
  eventSuccess,
  resolveWeek,
  validatePlan,
} from "./game.js";

const balanced = {
  work: { recruit: 1, practice: 1, event: 1, proposal: 0, upkeep: 0 },
  venue: "gym",
  eventType: "showcase",
  useSecondary: true,
};

describe("campus club budget game", () => {
  it("requires exactly three integer officer work points", () => {
    expect(() => validatePlan({ ...balanced, work: { ...balanced.work, recruit: 2 } })).toThrow(/3 點/);
    expect(() => validatePlan({ ...balanced, work: { ...balanced.work, recruit: 0.5, practice: 1.5 } })).toThrow(/整數/);
    expect(() => validatePlan(balanced)).not.toThrow();
  });

  it("offers all five distinct work actions", () => {
    expect(Object.keys(ACTIONS)).toEqual(["recruit", "practice", "event", "proposal", "upkeep"]);
  });

  it("awards a contested venue by prestige plus proposal quality", () => {
    const clubs = [
      { id: "player", prestige: 5, proposal: 3 },
      { id: "ai-a", prestige: 7, proposal: 0 },
      { id: "ai-b", prestige: 2, proposal: 1 },
    ];
    const plans = clubs.map(() => ({ venue: "gym", useSecondary: true }));
    const result = allocateVenues(clubs, plans, 44, 2);
    expect(result.player.venue).toBe("gym");
    expect(result["ai-a"].venue).not.toBe("gym");
  });

  it("breaks exact venue ties deterministically and gives losers secondary rooms", () => {
    const clubs = [
      { id: "a", prestige: 4, proposal: 2 },
      { id: "b", prestige: 4, proposal: 2 },
    ];
    const plans = clubs.map(() => ({ venue: "auditorium", useSecondary: true }));
    expect(allocateVenues(clubs, plans, 9, 1)).toEqual(allocateVenues(clubs, plans, 9, 1));
    const assigned = allocateVenues(clubs, plans, 9, 1);
    expect(Object.values(assigned).filter((x) => x.venue === "auditorium")).toHaveLength(1);
    expect(Object.values(assigned).some((x) => x.secondary)).toBe(true);
  });

  it("moves interested students in and out based on recruiting and satisfaction", () => {
    const club = { members: 20, interest: 8, satisfaction: 6 };
    const growing = applyMemberFlow(club, { recruit: 2 }, 0.7);
    const shrinking = applyMemberFlow({ ...club, interest: 1, satisfaction: 1 }, { recruit: 0 }, 0.7);
    expect(growing.members).toBeGreaterThan(club.members);
    expect(growing.interest).toBeLessThanOrEqual(10);
    expect(shrinking.members).toBeLessThan(club.members);
  });

  it("resolves event success reproducibly from seed, prep, venue fit, and weekly event", () => {
    const input = {
      seed: 87,
      week: 4,
      prep: 5,
      practice: 4,
      venue: "gym",
      eventType: "tournament",
      weeklyEvent: "sportsWeek",
      safety: 6,
      upkeep: 2,
    };
    expect(eventSuccess(input)).toEqual(eventSuccess(input));
    expect(eventSuccess(input).score).toBeGreaterThan(
      eventSuccess({ ...input, prep: 0, venue: "classroom", weeklyEvent: "examRush" }).score,
    );
  });

  it("caps overall evaluation when participation is too low", () => {
    const result = evaluateClub({ participation: 2, outcomes: 10, finance: 10, safety: 10 });
    expect(result.overall).toBeLessThanOrEqual(49);
    expect(result.cappedBy).toContain("participation");
  });

  it("caps overall evaluation when outcomes are too low", () => {
    const result = evaluateClub({ participation: 10, outcomes: 2, finance: 10, safety: 10 });
    expect(result.overall).toBeLessThanOrEqual(49);
    expect(result.cappedBy).toContain("outcomes");
  });

  it("caps overall evaluation when finance is too low", () => {
    const result = evaluateClub({ participation: 10, outcomes: 10, finance: 2, safety: 10 });
    expect(result.overall).toBeLessThanOrEqual(49);
    expect(result.cappedBy).toContain("finance");
  });

  it("caps overall evaluation when safety is too low", () => {
    const result = evaluateClub({ participation: 10, outcomes: 10, finance: 10, safety: 2 });
    expect(result.overall).toBeLessThanOrEqual(49);
    expect(result.cappedBy).toContain("safety");
  });

  it("keeps every AI weekly plan legal", () => {
    const game = createGame({ seed: 123 });
    for (let week = 1; week <= 8; week += 1) {
      for (const club of game.clubs.slice(1)) {
        expect(() => validatePlan(aiPlan(club, game.weeklyEvent, game.seed + week))).not.toThrow();
      }
    }
  });

  it("plays exactly eight weeks and ranks four clubs by final evaluation", () => {
    let game = createGame({ seed: 321 });
    for (let week = 0; week < 8; week += 1) game = resolveWeek(game, balanced);
    expect(game.week).toBe(8);
    expect(game.phase).toBe("ended");
    expect(game.ranking).toHaveLength(4);
    expect(game.ranking[0].evaluation.overall).toBeGreaterThanOrEqual(game.ranking[1].evaluation.overall);
  });
});
