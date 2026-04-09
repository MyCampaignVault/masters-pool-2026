// ESPN Golf Leaderboard + Masters.com Scorecard Proxy
// Combines ESPN leaderboard data with Masters.com hole-by-hole scores
// for eagle/bogey tracking. Graceful fallback if Masters.com fails.

let cache = { data: null, timestamp: 0 };
const CACHE_TTL = 60 * 1000;

// Fetch hole-by-hole data from masters.com (graceful fallback)
async function fetchMastersScorecard() {
  try {
    const year = new Date().getFullYear();
    const resp = await fetch(
      `https://www.masters.com/en_US/scores/feeds/${year}/scores.json`,
      { headers: { "User-Agent": "MastersPool/1.0", Accept: "application/json" }, signal: AbortSignal.timeout(5000) }
    );
    if (!resp.ok) return null;
    const raw = await resp.json();
    const players = raw?.data?.player || [];
    const pars = raw?.data?.pars || {};

    // Build a map: playerName -> { eagles, birdies, bogeys, doublePlus }
    const scorecardMap = {};
    for (const p of players) {
      const name = p.full_name || `${p.first_name} ${p.last_name}`;
      let eagles = 0, birdies = 0, bogeys = 0, doublePlus = 0;

      for (const roundKey of ["round1", "round2", "round3", "round4"]) {
        const round = p[roundKey];
        const parArr = pars[roundKey] || [];
        if (!round?.scores || parArr.length === 0) continue;

        for (let i = 0; i < round.scores.length; i++) {
          const score = round.scores[i];
          const par = parArr[i];
          if (score == null || par == null) continue;
          const diff = score - par;
          if (diff <= -2) eagles++;
          else if (diff === -1) birdies++;
          else if (diff === 1) bogeys++;
          else if (diff >= 2) doublePlus++;
        }
      }

      scorecardMap[name.toLowerCase()] = { eagles, birdies, bogeys, doublePlus, bogeyPlus: bogeys + doublePlus };
    }
    return scorecardMap;
  } catch (err) {
    console.error("Masters scorecard fetch failed (non-fatal):", err.message);
    return null;
  }
}

// Normalize name for matching between ESPN and Masters.com
function normName(name) {
  return (name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s-]/g, "")
    .trim();
}

function matchScorecard(espnName, scorecardMap) {
  if (!scorecardMap) return null;
  const norm = normName(espnName);

  // Exact match
  if (scorecardMap[norm]) return scorecardMap[norm];

  // Last name match
  const lastName = norm.split(/\s+/).pop();
  const entries = Object.entries(scorecardMap);
  const lastMatches = entries.filter(([k]) => k.split(/\s+/).pop() === lastName);
  if (lastMatches.length === 1) return lastMatches[0][1];

  // Partial match
  const partial = entries.find(([k]) => k.includes(norm) || norm.includes(k));
  if (partial) return partial[1];

  return null;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const now = Date.now();
  if (cache.data && now - cache.timestamp < CACHE_TTL) {
    return res.status(200).json(cache.data);
  }

  try {
    // Fetch ESPN leaderboard and Masters.com scorecards in parallel
    const [espnResp, scorecardMap] = await Promise.all([
      fetch("https://site.api.espn.com/apis/site/v2/sports/golf/leaderboard", {
        headers: { "User-Agent": "MastersPool/1.0", Accept: "application/json" },
      }),
      fetchMastersScorecard(),
    ]);

    if (!espnResp.ok) {
      throw new Error(`ESPN API returned ${espnResp.status}`);
    }

    const raw = await espnResp.json();
    const event = raw.events?.[0];

    if (!event) {
      return res.status(200).json({
        tournament: "The Masters",
        status: "pre_event",
        round: 0,
        golfers: [],
        lastUpdated: new Date().toISOString(),
        error: "No active event found",
      });
    }

    const competition = event.competitions?.[0];
    const competitors = competition?.competitors || [];

    const golfers = competitors.map((c) => {
      const athlete = c.athlete || {};
      const status = c.status || {};
      const linescores = c.linescores || [];
      const statistics = c.statistics || [];

      // Parse score to par from statistics array
      let scoreToPar = 0;
      const scoreToParStat = statistics.find((s) => s.name === "scoreToPar");
      if (scoreToParStat) {
        if (scoreToParStat.displayValue === "E") {
          scoreToPar = 0;
        } else if (scoreToParStat.value != null) {
          scoreToPar = Number(scoreToParStat.value);
        } else {
          const parsed = parseInt(scoreToParStat.displayValue, 10);
          if (!isNaN(parsed)) scoreToPar = parsed;
        }
      } else {
        const scoreDisplay = c.score?.displayValue;
        if (scoreDisplay === "E") {
          scoreToPar = 0;
        } else if (scoreDisplay) {
          const parsed = parseInt(scoreDisplay, 10);
          if (!isNaN(parsed)) scoreToPar = parsed;
        }
      }

      // Parse today's round score
      let today = null;
      const currentRound = (event.status?.period || 1) - 1;
      const currentLinescore = linescores[currentRound];
      if (currentLinescore?.displayValue) {
        if (currentLinescore.displayValue === "E") today = 0;
        else {
          const p = parseInt(currentLinescore.displayValue, 10);
          if (!isNaN(p)) today = p;
        }
      }

      // Parse individual rounds
      const rounds = linescores.map((l) => {
        const v = l.value ?? l.displayValue;
        return v != null ? Number(v) : null;
      });

      const statusName = status.type?.name || "";
      const isCut =
        statusName === "STATUS_CUT" ||
        statusName === "STATUS_DISQUALIFIED" ||
        statusName === "STATUS_WITHDRAWN";

      const displayName = athlete.displayName || athlete.shortName || "Unknown";

      // Match with Masters.com scorecard for eagle/bogey data
      const card = matchScorecard(displayName, scorecardMap);

      return {
        name: displayName,
        shortName: athlete.shortName || "",
        position: status.position?.displayName || c.sortOrder?.toString() || "",
        scoreToPar,
        today,
        thru: status.thru != null ? (status.thru === 18 ? "F" : status.thru.toString()) : status.displayValue || "",
        rounds,
        status: isCut ? "cut" : "active",
        isCut,
        eagles: card?.eagles ?? null,
        bogeyPlus: card?.bogeyPlus ?? null,
      };
    });

    // Determine tournament status
    let tournamentStatus = "in_progress";
    const eventStatus = event.status?.type?.name || "";
    if (eventStatus.includes("PRE") || eventStatus.includes("SCHEDULED")) {
      tournamentStatus = "pre_event";
    } else if (eventStatus.includes("FINAL") || eventStatus.includes("POST")) {
      tournamentStatus = "post_event";
    }

    const result = {
      tournament: event.name || event.shortName || "The Masters",
      status: tournamentStatus,
      round: event.status?.period || 0,
      golfers,
      hasScorecards: !!scorecardMap,
      lastUpdated: new Date().toISOString(),
    };

    cache = { data: result, timestamp: now };
    return res.status(200).json(result);
  } catch (error) {
    console.error("Leaderboard fetch error:", error.message);

    if (cache.data) {
      return res.status(200).json({
        ...cache.data,
        stale: true,
        lastUpdated: new Date(cache.timestamp).toISOString(),
      });
    }

    return res.status(500).json({
      tournament: "The Masters",
      status: "error",
      round: 0,
      golfers: [],
      lastUpdated: new Date().toISOString(),
      error: "Failed to fetch live scores. Retrying...",
    });
  }
}
