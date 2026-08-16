import { CampusAudio } from "./audio.js";
import { ACTIONS, EVENT_TYPES, VENUES, createGame, resolveWeek } from "./game.js";
import { loadProgress, saveBest, saveUnlocks } from "./persist.js";

const $ = (selector) => document.querySelector(selector);
const audio = new CampusAudio();
const workTips = {
  recruit: "拉高興趣，讓社員淨流入",
  practice: "提升活動表現與滿意度",
  event: "直接增加本週活動準備",
  proposal: "提高熱門場地申請分數",
  upkeep: "修器材、守住安全短板",
};
const venueTips = {
  gym: "交流賽 +3",
  auditorium: "成果展 +3",
  lab: "體驗坊 +3",
  classroom: "體驗坊 +2",
  courtyard: "成果展 +2",
};
const clubColors = ["#ffd95a", "#ff6f91", "#50c8ff", "#68e0a0"];
const badgeNames = {
  safe: "安全標竿",
  popular: "社員爆棚",
  solvent: "精打細算",
  champion: "預算王",
};

let game = null;
let progress = { best: 0, unlocks: [] };
let work = { recruit: 1, practice: 0, event: 1, proposal: 1, upkeep: 0 };
let venue = "gym";
let eventType = "showcase";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderPickers() {
  $("#work-grid").innerHTML = Object.entries(ACTIONS)
    .map(
      ([key, action]) => `
        <div class="work-row">
          <span class="work-icon" aria-hidden="true">${action.icon}</span>
          <span class="work-copy"><strong>${action.name}</strong><small>${workTips[key]}</small></span>
          <span class="stepper">
            <button type="button" data-work="${key}" data-delta="-1" aria-label="減少${action.name}">−</button>
            <output id="work-${key}">${work[key]}</output>
            <button type="button" data-work="${key}" data-delta="1" aria-label="增加${action.name}">＋</button>
          </span>
        </div>`,
    )
    .join("");
  $("#venue-picker").innerHTML = Object.entries(VENUES)
    .map(
      ([key, item]) => `
        <button type="button" class="choice ${key === venue ? "selected" : ""}" data-venue="${key}" aria-pressed="${key === venue}">
          <span>${item.name}</span><small>${venueTips[key]}</small>
        </button>`,
    )
    .join("");
  $("#event-picker").innerHTML = Object.entries(EVENT_TYPES)
    .map(
      ([key, item]) => `
        <button type="button" class="${key === eventType ? "selected" : ""}" data-event-type="${key}" aria-pressed="${key === eventType}">
          ${item.name}<small>基本 $${item.cost}</small>
        </button>`,
    )
    .join("");
}

function updatePlanner() {
  const used = Object.values(work).reduce((sum, value) => sum + value, 0);
  const left = 3 - used;
  $("#points-left").textContent = left === 0 ? "分配完成" : left > 0 ? `剩 ${left} 點` : `超出 ${-left} 點`;
  $("#points-left").className = `points ${left === 0 ? "full" : left < 0 ? "bad" : ""}`;
  Object.keys(ACTIONS).forEach((key) => {
    const output = $(`#work-${key}`);
    if (output) output.textContent = work[key];
  });
  const player = game?.clubs[0];
  const estimated = EVENT_TYPES[eventType].cost + work.recruit * 2 + work.upkeep * 2;
  const affordable = !player || player.budget >= estimated;
  $("#plan-message").textContent = !affordable
    ? `本週至少需要 $${estimated}，目前預算不足。活動會取消，請改策略。`
    : left === 0
      ? `預估投入 $${estimated}；申請分數 ${player ? (player.prestige + player.proposal + work.proposal * 1.5).toFixed(1) : "—"}`
      : "請把 3 點工時全部分配完。";
  $("#resolve-button").disabled = left !== 0;
}

function renderHud() {
  const player = game.clubs[0];
  $("#week-value").textContent = `${game.week} / ${game.maxWeeks}`;
  $("#budget-value").textContent = `$${player.budget}`;
  $("#members-value").textContent = `${player.members} 人`;
  $("#prestige-value").textContent = player.prestige.toFixed(1);
  $("#gear-value").textContent = player.gear.toFixed(1);
  $("#safety-value").textContent = player.safety.toFixed(1);
}

function renderWeekEvent() {
  $("#week-event").innerHTML = `
    <img src="./assets/images/${game.weeklyEvent.id === "examRush" ? "sad" : "idea"}.png" alt="" />
    <div><p>第 ${game.week} 週校園風向</p><strong>${game.weeklyEvent.name}</strong><p>${game.weeklyEvent.tip}</p></div>`;
}

function renderClubs() {
  $("#club-grid").innerHTML = game.clubs
    .map((club, index) => {
      const last = game.lastReport?.reports[club.id];
      const detail = last
        ? `${last.assignment.venue ? VENUES[last.assignment.venue].name : "申請落空"} · ${last.event.label}`
        : `社員 ${club.members} · 企劃 ${club.proposal.toFixed(1)}`;
      return `
        <article class="club-card ${club.id === "player" ? "player" : ""}" style="--accent:${clubColors[index]}">
          <strong>${escapeHtml(club.name)}</strong>
          <span>${detail}</span>
          <span>聲望 ${club.prestige.toFixed(1)} · 預算 $${club.budget}</span>
        </article>`;
    })
    .join("");
}

function renderGame() {
  renderHud();
  renderWeekEvent();
  renderClubs();
  updatePlanner();
}

function weeklyTitle(report) {
  if (!report.held) return "活動被迫取消…";
  if (report.event.score >= 15) return "校園群組洗版啦！";
  if (report.event.success) return "這場辦得漂亮！";
  return "有辦完，但有點狼狽";
}

function showWeekResult(report) {
  const assignment = report.assignment;
  $("#result-emote").src = report.event.success ? "./assets/images/happy.png" : "./assets/images/sad.png";
  $("#result-kicker").textContent = `第 ${game.lastReport.week} 週結案報告`;
  $("#result-title").textContent = weeklyTitle(report);
  $("#result-content").innerHTML = `
    <p>${assignment.secondary ? "熱門場地落選，改用備選。" : "場地申請結果出爐。"}本週在 <strong>${assignment.venue ? VENUES[assignment.venue].name : "沒有場地"}</strong> 舉辦 ${EVENT_TYPES[report.plan.eventType].name}。</p>
    <div class="report-grid">
      <div><span>活動分數</span><strong>${report.event.score}</strong></div>
      <div><span>參與人次</span><strong>${report.attendance}</strong></div>
      <div><span>本週收支</span><strong>${report.income - report.cost >= 0 ? "+" : ""}$${report.income - report.cost}</strong></div>
    </div>
    <p class="result-note">場地契合 ${report.event.venueFit >= 0 ? "+" : ""}${report.event.venueFit} · 校園風向 ${report.event.weeklyFit >= 0 ? "+" : ""}${report.event.weeklyFit}<br />社員加入 ${report.joined}、離開 ${report.left}。成果不是只靠申請：練習、籌備與安全都會進分數。</p>`;
  $("#continue-button").textContent = "翻到下週行事曆";
  $("#result-sheet").hidden = false;
  $("#continue-button").focus();
}

function evaluationBars(evaluation) {
  const labels = { participation: "參與", outcomes: "成果", finance: "財務", safety: "安全" };
  return Object.entries(labels)
    .map(
      ([key, label]) => `
        <div class="eval-row"><span>${label}</span><span class="bar"><i style="width:${evaluation[key] * 10}%"></i></span><strong>${evaluation[key].toFixed(1)}</strong></div>`,
    )
    .join("");
}

function earnedBadges(player, rank) {
  const earned = [];
  if (player.safety >= 8) earned.push("safe");
  if (player.members >= 28) earned.push("popular");
  if (player.budget >= 70) earned.push("solvent");
  if (rank === 1) earned.push("champion");
  return earned;
}

async function showFinal() {
  const player = game.ranking.find((club) => club.id === "player");
  const rank = game.ranking.findIndex((club) => club.id === "player") + 1;
  const earned = earnedBadges(player, rank);
  progress.best = await saveBest(player.evaluation.overall, progress.best);
  progress.unlocks = await saveUnlocks([...progress.unlocks, ...earned]);
  renderProgress();
  $("#result-emote").src = rank === 1 ? "./assets/images/happy.png" : "./assets/images/idea.png";
  $("#result-kicker").textContent = "第八週 · 學生事務處總評";
  $("#result-title").textContent = rank === 1 ? "年度預算核准！" : `本學期第 ${rank} 名`;
  const capText = player.evaluation.cappedBy.length
    ? `<p class="result-note">短板封頂生效：${player.evaluation.cappedBy.map((key) => ({ participation: "參與", outcomes: "成果", finance: "財務", safety: "安全" })[key]).join("、")}低於 3 分，總評最高 49。</p>`
    : "";
  const medals = ["gold.png", "silver.png", "bronze.png", "bronze.png"];
  $("#result-content").innerHTML = `
    <div class="eval-bars">${evaluationBars(player.evaluation)}</div>${capText}
    <ol class="ranking">${game.ranking
      .map(
        (club, index) => `<li class="${club.id === "player" ? "player" : ""}"><img src="./assets/images/${medals[index]}" alt="" /><span>${escapeHtml(club.name)}<small>預算 $${club.budget} · ${club.members} 人</small></span><strong>${club.evaluation.overall}</strong></li>`,
      )
      .join("")}</ol>
    <p class="kicker">本局徽章</p><div class="badge-list">${earned.length ? earned.map((key) => `<span class="badge">✦ ${badgeNames[key]}</span>`).join("") : '<span class="result-note">這次沒有新徽章，再調整短板試試！</span>'}</div>`;
  $("#continue-button").textContent = "成立另一個社團";
  $("#result-sheet").hidden = false;
  $("#continue-button").focus();
  audio.play(rank === 1 ? "stamp" : "pop");
}

function renderProgress() {
  $("#best-score").textContent = String(progress.best);
  $("#unlock-count").textContent = `${progress.unlocks.length} / 4`;
}

function resetPlan() {
  work = { recruit: 1, practice: 0, event: 1, proposal: 1, upkeep: 0 };
  renderPickers();
  updatePlanner();
}

$("#work-grid").addEventListener("click", (event) => {
  const button = event.target.closest("[data-work]");
  if (!button) return;
  const key = button.dataset.work;
  work[key] = Math.max(0, Math.min(3, work[key] + Number(button.dataset.delta)));
  audio.play("click");
  updatePlanner();
});

$("#venue-picker").addEventListener("click", (event) => {
  const button = event.target.closest("[data-venue]");
  if (!button) return;
  venue = button.dataset.venue;
  document.querySelectorAll("[data-venue]").forEach((item) => {
    const selected = item === button;
    item.classList.toggle("selected", selected);
    item.setAttribute("aria-pressed", String(selected));
  });
  audio.play("click");
  updatePlanner();
});

$("#event-picker").addEventListener("click", (event) => {
  const button = event.target.closest("[data-event-type]");
  if (!button) return;
  eventType = button.dataset.eventType;
  document.querySelectorAll("[data-event-type]").forEach((item) => {
    const selected = item === button;
    item.classList.toggle("selected", selected);
    item.setAttribute("aria-pressed", String(selected));
  });
  audio.play("click");
  updatePlanner();
});

$("#start-button").addEventListener("click", async () => {
  const clubName = $("#club-name").value.trim() || "放學後研究社";
  await audio.start();
  audio.play("stamp");
  game = createGame({ seed: Date.now(), clubName });
  globalThis.__clubbudg = { getGame: () => game };
  $("#lobby").hidden = true;
  $("#game").hidden = false;
  resetPlan();
  renderGame();
  $("#resolve-button").focus();
});

$("#resolve-button").addEventListener("click", () => {
  try {
    game = resolveWeek(game, {
      work: { ...work },
      venue,
      eventType,
      useSecondary: $("#use-secondary").checked,
    });
    renderGame();
    audio.play("stamp");
    if (game.phase === "ended") void showFinal();
    else showWeekResult(game.lastReport.player);
  } catch (error) {
    $("#plan-message").textContent = error.message;
    audio.play("pop");
  }
});

$("#continue-button").addEventListener("click", () => {
  audio.play("click");
  $("#result-sheet").hidden = true;
  if (game.phase === "ended") {
    game = null;
    $("#game").hidden = true;
    $("#lobby").hidden = false;
    $("#start-button").focus();
  } else {
    resetPlan();
    renderGame();
    $("#resolve-button").focus();
  }
});

$("#sound-toggle").addEventListener("click", () => {
  audio.setEnabled(!audio.enabled);
  $("#sound-toggle").textContent = audio.enabled ? "♫ 音樂開" : "♩ 音樂關";
  $("#sound-toggle").setAttribute("aria-pressed", String(audio.enabled));
  if (audio.enabled) audio.play("click");
});

$("#how-button").addEventListener("click", () => {
  $("#about-sheet").hidden = false;
  $("#about-close").focus();
  audio.play("click");
});
$("#about-close").addEventListener("click", () => {
  $("#about-sheet").hidden = true;
  $("#how-button").focus();
  audio.play("click");
});

progress = await loadProgress();
renderProgress();
renderPickers();
updatePlanner();
