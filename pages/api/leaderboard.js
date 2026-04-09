// ESPN Golf Leaderboard Proxy
// Caches responses for 60 seconds to avoid rate limiting

let cache = { data: null, timestamp: 0 };
const CACHE_TTL = 60 * 1000; // 60 seconds

export default async function handler(req, res) {
  // Allow CORS
  res.setHeader("Access-Control-Allow-Origin", "*");

  const now = Date.now();
  if (cache.data && now - cache.timestamp < CACHE_TTL) {
    return res.status(200).json(cache.data);
  }

  try {
    // ESPN Golf leaderboard — returns current/most recent event
    const response = await fetch(
      "https://site.api.espn.com/apis/site/v2/sports/golf/leaderboard",
      {
        headers: {
          "User-Agent": "MastersPool/1.0",
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`ESPN API returned ${response.status}`);
    }

    const raw = await response.json();
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
        // Fallback to score.displayValue
        const scoreDisplay = c.score?.displayValue;
        if (scoreDisplay === "E") {
          scoreToPar = 0;
        } else if (scoreDisplay) {
          const parsed = parseInt(scoreDisplay, 10);
          if (!isNaN(parsed)) scoreToPar = parsed;
        }
      }

      // Parse today's round score from current round linescore
      let today = null;
      const currentRound = (event.status?.period || 1) - 1;
      const currentLinescore = linescores[currentRound];
      if (currentLinescore?.displayValue) {
        if (currentLinescore.displayValue === "E") {
          today = 0;
        } else {
          const p = parseInt(currentLinescore.displayValue, 10);
          if (!isNaN(p)) today = p;
        }
      }

      // Parse individual rounds
      const rounds = linescores.map((l) => {
        const v = l.value ?? l.displayValue;
        return v != null ? Number(v) : null;
      });

      // Determine if golfer made the cut
      const statusName = status.type?.name || "";
      const isCut =
        statusName === "STATUS_CUT" ||
        statusName === "STATUS_DISQUALIFIED" ||
        statusName === "STATUS_WITHDRAWN";

      return {
        name: athlete.displayName || athlete.shortName || "Unknown",
        shortName: athlete.shortName || "",
        position: status.position?.displayName || c.sortOrder?.toString() || "",
        scoreToPar,
        today,
        thru: status.thru != null ? (status.thru === 18 ? "F" : status.thru.toString()) : status.displayValue || "",
        rounds,
        status: isCut ? "cut" : "active",
        isCut,
      };
    });

    // Determine tournament status
    let tournamentStatus = "in_progress";
    const eventStatus = event.status?.type?.name || "";
    if (
      eventStatus.includes("PRE") ||
      eventStatus.includes("SCHEDULED")
    ) {
      tournamentStatus = "pre_event";
    } else if (
      eventStatus.includes("FINAL") ||
      eventStatus.includes("POST")
    ) {
      tournamentStatus = "post_event";
    }

    const result = {
      tournament: event.name || event.shortName || "The Masters",
      status: tournamentStatus,
      round: event.status?.period || 0,
      golfers,
      lastUpdated: new Date().toISOString(),
    };

    // Cache it
    cache = { data: result, timestamp: now };

    return res.status(200).json(result);
  } catch (error) {
    console.error("Leaderboard fetch error:", error.message);

    // Return cached data if available, even if stale
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
