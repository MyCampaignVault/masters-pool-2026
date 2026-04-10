import { useState, useEffect, useCallback } from "react";
import Head from "next/head";

// ─── Pool Data ────────────────────────────────────────────────
const POOL_PLAYERS = [
  {
    name: "Bowlby",
    golfers: [
      "Scottie Scheffler", "Akshay Bhatia", "Justin Thomas",
      "Gary Woodland", "Sungjae Im", "Haotong Li",
      "Carlos Ortiz", "Angel Cabrera", "Mateo Pulcini",
    ],
  },
  {
    name: "Donovan",
    golfers: [
      "Rory McIlroy", "Patrick Cantlay", "Jason Day",
      "Harris English", "Daniel Berger", "Ryan Fox",
      "Aldrich Potgieter", "Zach Johnson", "Davis Riley",
    ],
  },
  {
    name: "Brad",
    golfers: [
      "Bryson DeChambeau", "Viktor Hovland", "Russell Henley",
      "Cameron Smith", "Dustin Johnson", "Nick Taylor",
      "Andrew Novak", "Jackson Herrington", "Charl Schwartzel",
    ],
  },
  {
    name: "Ricksta",
    golfers: [
      "Xander Schauffele", "Jordan Spieth", "Chris Gotterup",
      "Maverick McNealy", "Kurt Kitayama", "Max Greyserman",
      "Alex Noren", "Michael Brennan", "Vijay Singh",
    ],
  },
  {
    name: "Slaymon",
    golfers: [
      "Jon Rahm", "Robert MacIntyre", "Sepp Straka",
      "Corey Conners", "Arco Penge", "Tom McKibbin",
      "Nico Echavarria", "Ethan Fang", "Fred Couples",
    ],
  },
  {
    name: "Schank",
    golfers: [
      "Ludvig Aberg", "Brooks Koepka", "Shane Lowry",
      "Sam Burns", "Rasmus Hojgaard", "Aaron Rai",
      "Sergio Garcia", "Brandon Holtz", "Danny Willett",
    ],
  },
  {
    name: "Chuck",
    golfers: [
      "Cameron Young", "Patrick Reed", "Si Woo Kim",
      "Jacob Bridgeman", "Brian Harman", "Sam Stevens",
      "Michael Kim", "Brian Campbell", "Jose Maria Olazabal",
    ],
  },
  {
    name: "Chambo",
    golfers: [
      "Justin Rose", "Matt Fitzpatrick", "Adam Scott",
      "J.J. Spaun", "Ben Griffin", "Ryan Gerard",
      "Matt McCarty", "Rasmus Neergaard-Petersen", "Naoyuki Kataoka",
    ],
  },
  {
    name: "Grubbs",
    golfers: [
      "Tommy Fleetwood", "Collin Morikawa", "Tyrrell Hatton",
      "Jake Knapp", "Wyndham Clark", "Casey Jarvis",
      "Kristoffer Reitan", "Bubba Watson", "Fifa Laopakdee",
    ],
  },
  {
    name: "Sertich",
    golfers: [
      "Hideki Matsuyama", "Min Woo Lee", "Nicolai Hojgaard",
      "Max Homa", "Keegan Bradley", "Harry Hall",
      "Johnny Keefer", "Sai Valimaki", "Mike Weir",
    ],
  },
];

const CATEGORIES = {
  overall: { label: "1st Place", emoji: "\u{1F3C6}", payout: 175 },
  second: { label: "2nd Place", emoji: "\u{1F948}", payout: 100 },
  lowRound: { label: "Low Round", emoji: "\u{1F525}", payout: 75 },
  eagles: { label: "Most Eagles", emoji: "\u{1F985}", payout: 75 },
  cuts: { label: "Most Cuts", emoji: "\u2702\uFE0F", payout: 50 },
  bogeys: { label: "Most Bogeys+", emoji: "\u{1F534}", payout: 25 },
};

// ─── Name Matching ────────────────────────────────────────────
function normalize(name) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z\s-]/g, "").trim();
}

function getLastName(name) {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1];
}

function matchGolfer(pickName, espnGolfers) {
  const normPick = normalize(pickName);
  const exact = espnGolfers.find((g) => normalize(g.name) === normPick);
  if (exact) return exact;
  const pickLast = normalize(getLastName(pickName));
  const lastMatches = espnGolfers.filter((g) => normalize(getLastName(g.name)) === pickLast);
  if (lastMatches.length === 1) return lastMatches[0];
  if (lastMatches.length > 1) {
    const pickFirst = normalize(pickName.split(/\s+/)[0]);
    const firstMatch = lastMatches.find((g) => normalize(g.name).startsWith(pickFirst));
    if (firstMatch) return firstMatch;
  }
  const partial = espnGolfers.find((g) => normalize(g.name).includes(normPick) || normPick.includes(normalize(g.name)));
  if (partial) return partial;
  return null;
}

function formatScore(n) {
  if (n == null || isNaN(n)) return "--";
  if (n === 0) return "E";
  return n > 0 ? `+${n}` : `${n}`;
}

function scoreColor(n) {
  if (n == null || isNaN(n)) return "#a8c5a0";
  if (n < 0) return "#6bcf7f";
  if (n > 0) return "#e05c5c";
  return "#f5e6c8";
}

export default function MastersPool() {
  const [liveData, setLiveData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const [activeTab, setActiveTab] = useState("leaderboard");
  const [expandedPlayer, setExpandedPlayer] = useState(null);
  const [countdown, setCountdown] = useState(60);

  const fetchScores = useCallback(async () => {
    try {
      const res = await fetch("/api/leaderboard");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setLiveData(data);
      setLastFetch(new Date());
      setError(null);
      setCountdown(60);
    } catch (err) {
      setError("Unable to fetch live scores. Retrying...");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchScores(); const i = setInterval(fetchScores, 60000); return () => clearInterval(i); }, [fetchScores]);
  useEffect(() => { const t = setInterval(() => setCountdown((c) => (c > 0 ? c - 1 : 60)), 1000); return () => clearInterval(t); }, []);

  const espnGolfers = liveData?.golfers || [];

  const poolStandings = POOL_PLAYERS.map((player) => {
    let totalScore = 0, bestRound = Infinity, cutsMade = 0, matched = 0;
    let totalEagles = 0, totalBogeyPlus = 0;

    const golferDetails = player.golfers.map((pickName) => {
      const live = matchGolfer(pickName, espnGolfers);
      if (live) {
        matched++;
        totalScore += live.scoreToPar || 0;
        if (!live.isCut) cutsMade++;
        (live.rounds || []).forEach((r) => { if (r != null && r < bestRound) bestRound = r; });
        if (live.eagles != null) totalEagles += live.eagles;
        if (live.bogeyPlus != null) totalBogeyPlus += live.bogeyPlus;
      }
      return { pickName, live, found: !!live };
    });

    return {
      ...player, totalScore, bestRound: bestRound === Infinity ? null : bestRound,
      cutsMade, matched, golferDetails, totalEagles, totalBogeyPlus,
    };
  });

  const sorted = [...poolStandings].sort((a, b) => a.totalScore - b.totalScore);

  const winners = {};
  const winnersGolfer = {};

  // 1st & 2nd Place: individual golfer tournament position
  const sortedEspnGolfers = [...espnGolfers].filter((g) => !g.isCut).sort((a, b) => a.scoreToPar - b.scoreToPar);
  if (sortedEspnGolfers.length > 0) {
    const topGolfer = sortedEspnGolfers[0];
    const owner1st = POOL_PLAYERS.find((p) => p.golfers.some((g) => matchGolfer(g, [topGolfer])));
    if (owner1st) { winners.overall = owner1st.name; winnersGolfer.overall = topGolfer.name; }
  }
  if (sortedEspnGolfers.length > 1) {
    const secondGolfer = sortedEspnGolfers[1];
    const owner2nd = POOL_PLAYERS.find((p) => p.golfers.some((g) => matchGolfer(g, [secondGolfer])));
    if (owner2nd) { winners.second = owner2nd.name; winnersGolfer.second = secondGolfer.name; }
  }

  // Low round: individual golfer's lowest single round
  const withRounds = sorted.filter((p) => p.bestRound != null);
  if (withRounds.length > 0) {
    const best = Math.min(...withRounds.map((p) => p.bestRound));
    winners.lowRound = withRounds.find((p) => p.bestRound === best)?.name;
  }

  // Most Eagles: pool player whose golfers combined for the most eagles
  const maxEagles = Math.max(...sorted.map((p) => p.totalEagles));
  if (maxEagles > 0) {
    winners.eagles = sorted.find((p) => p.totalEagles === maxEagles)?.name;
  }

  // Most Cuts (only meaningful once the cut line has been applied)
  const cutApplied = espnGolfers.some((g) => g.isCut);
  if (cutApplied) {
    const maxCuts = Math.max(...sorted.map((p) => p.cutsMade));
    if (maxCuts > 0) {
      winners.cuts = sorted.find((p) => p.cutsMade === maxCuts)?.name;
    }
  }

  // Most Bogeys+: pool player whose golfers combined for most bogeys and worse
  const maxBogeys = Math.max(...sorted.map((p) => p.totalBogeyPlus));
  if (maxBogeys > 0) {
    winners.bogeys = sorted.find((p) => p.totalBogeyPlus === maxBogeys)?.name;
  }

  const hasScorecards = liveData?.hasScorecards;

  const s = {
    page: { minHeight: "100vh", background: "linear-gradient(160deg, #0a1a0f 0%, #0f2415 40%, #081810 100%)", fontFamily: "'Playfair Display', Georgia, serif", color: "#f5e6c8" },
    header: { background: "linear-gradient(180deg, #1a3a1f 0%, #0f2415 100%)", borderBottom: "3px solid #c9a84c", padding: "28px 20px 22px", textAlign: "center", position: "relative" },
    headerPattern: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(201,168,76,0.03) 10px, rgba(201,168,76,0.03) 20px)" },
    subtitle: { fontSize: "11px", letterSpacing: "6px", color: "#c9a84c", marginBottom: "8px", textTransform: "uppercase", position: "relative" },
    title: { margin: 0, fontSize: "clamp(24px, 5vw, 38px)", fontWeight: "normal", color: "#f5e6c8", letterSpacing: "2px", textShadow: "0 2px 20px rgba(201,168,76,0.3)", position: "relative" },
    meta: { fontSize: "13px", color: "#a8c5a0", marginTop: "6px", letterSpacing: "1px", position: "relative" },
    liveBar: { display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", padding: "8px 16px", background: "rgba(0,0,0,0.4)", borderBottom: "1px solid rgba(201,168,76,0.15)", fontSize: "12px" },
    liveDot: { width: "8px", height: "8px", borderRadius: "50%", background: "#6bcf7f", boxShadow: "0 0 8px #6bcf7f", animation: "pulse 2s infinite" },
    tab: (active) => ({ flex: 1, padding: "12px", background: "transparent", border: "none", borderBottom: active ? "3px solid #c9a84c" : "3px solid transparent", color: active ? "#c9a84c" : "#a8c5a0", fontSize: "13px", letterSpacing: "2px", textTransform: "uppercase", cursor: "pointer", fontFamily: "'Playfair Display', Georgia, serif", transition: "all 0.2s" }),
    card: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(201,168,76,0.15)", borderRadius: "10px", marginBottom: "10px", overflow: "hidden" },
    mono: { fontFamily: "'DM Mono', monospace" },
  };

  return (
    <>
      <Head>
        <title>Masters Pool 2026 - Live Tracker</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <style jsx global>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        * { box-sizing: border-box; }
        body { margin: 0; }
      `}</style>

      <div style={s.page}>
        <div style={s.header}>
          <div style={s.headerPattern} />
          <div style={s.subtitle}>Augusta National</div>
          <h1 style={s.title}>The Masters Pool 2026</h1>
          <div style={s.meta}>10 Players &middot; 9 Golfers Each &middot; $500 Pot</div>
        </div>

        <div style={s.liveBar}>
          {loading ? (
            <span style={{ color: "#c9a84c" }}>Loading live scores...</span>
          ) : error ? (
            <span style={{ color: "#e05c5c" }}>{error}</span>
          ) : (
            <>
              <div style={s.liveDot} />
              <span style={{ color: "#6bcf7f", fontWeight: "bold" }}>LIVE</span>
              <span style={{ color: "#a8c5a0" }}>
                {liveData?.tournament || "The Masters"} &middot; Round {liveData?.round || "—"}
              </span>
              <span style={{ color: "rgba(168,197,160,0.6)", ...s.mono }}>
                Next update: {countdown}s
              </span>
            </>
          )}
        </div>

        {/* Payout Banner */}
        <div style={{ display: "flex", overflowX: "auto", gap: 0, borderBottom: "1px solid rgba(201,168,76,0.2)", background: "rgba(0,0,0,0.3)" }}>
          {Object.entries(CATEGORIES).map(([key, cat]) => (
            <div key={key} style={{
              flex: "0 0 auto", padding: "10px 14px", textAlign: "center",
              borderRight: "1px solid rgba(201,168,76,0.1)",
              background: winners[key] ? "rgba(201,168,76,0.08)" : "transparent",
              minWidth: "100px",
            }}>
              <div style={{ fontSize: "18px" }}>{cat.emoji}</div>
              <div style={{ fontSize: "10px", color: "#a8c5a0", letterSpacing: "1px", marginTop: "2px" }}>{cat.label}</div>
              <div style={{ fontSize: "15px", color: "#c9a84c", fontWeight: "bold", marginTop: "2px" }}>${cat.payout}</div>
              <div style={{
                fontSize: "11px", color: "#f5e6c8", marginTop: "3px",
                background: "rgba(201,168,76,0.15)", borderRadius: "4px", padding: "2px 6px",
              }}>
                {winners[key] || "TBD"}
              </div>
              {winnersGolfer[key] && (
                <div style={{ fontSize: "9px", color: "#a8c5a0", marginTop: "2px" }}>({winnersGolfer[key]})</div>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", borderBottom: "1px solid rgba(201,168,76,0.2)", background: "rgba(0,0,0,0.2)" }}>
          {["leaderboard", "rosters", "golfers"].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={s.tab(activeTab === tab)}>
              {tab === "golfers" ? "All Golfers" : tab}
            </button>
          ))}
        </div>

        <div style={{ padding: "20px 16px", maxWidth: "940px", margin: "0 auto" }}>

          {activeTab === "leaderboard" && (
            <div>
              <p style={{ color: "#a8c5a0", fontSize: "13px", marginTop: 0, marginBottom: "16px" }}>
                Combined scores to par across each player&apos;s 9 golfers. 1st/2nd place prizes go to the player who drafted the top individual golfer.
              </p>

              {sorted.map((player, i) => (
                <div key={player.name} onClick={() => setExpandedPlayer(expandedPlayer === player.name ? null : player.name)}
                  style={{
                    ...s.card, cursor: "pointer",
                    border: i === 0 ? "1px solid rgba(201,168,76,0.5)" : i === 1 ? "1px solid rgba(201,168,76,0.25)" : "1px solid rgba(255,255,255,0.06)",
                    background: i === 0 ? "rgba(201,168,76,0.1)" : i === 1 ? "rgba(201,168,76,0.05)" : "rgba(255,255,255,0.03)",
                  }}>
                  <div style={{ display: "flex", alignItems: "center", padding: "14px 16px", gap: "12px" }}>
                    <div style={{
                      width: "34px", height: "34px", borderRadius: "50%",
                      background: i === 0 ? "#c9a84c" : i === 1 ? "rgba(200,200,200,0.25)" : "rgba(255,255,255,0.08)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "14px", fontWeight: "bold", color: i === 0 ? "#0a1a0f" : "#f5e6c8", flexShrink: 0,
                    }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "16px", fontWeight: "bold", color: i < 2 ? "#c9a84c" : "#f5e6c8" }}>{player.name}</div>
                      <div style={{ fontSize: "11px", color: "#a8c5a0", marginTop: "2px" }}>
                        {player.cutsMade}/{player.golfers.length} active
                        {hasScorecards && ` \u00b7 \u{1F985}${player.totalEagles} \u00b7 \u{1F534}${player.totalBogeyPlus}`}
                        {" "}\u00b7 Tap to expand
                      </div>
                    </div>
                    <div style={{ fontSize: "22px", fontWeight: "bold", color: scoreColor(player.totalScore), ...s.mono }}>
                      {formatScore(player.totalScore)}
                    </div>
                  </div>

                  {expandedPlayer === player.name && (
                    <div style={{ borderTop: "1px solid rgba(201,168,76,0.15)", padding: "12px 16px", background: "rgba(0,0,0,0.2)" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid rgba(201,168,76,0.2)" }}>
                            <th style={{ textAlign: "left", padding: "6px 4px", color: "#c9a84c", fontSize: "10px", letterSpacing: "1px" }}>GOLFER</th>
                            <th style={{ textAlign: "center", padding: "6px 4px", color: "#c9a84c", fontSize: "10px", letterSpacing: "1px" }}>POS</th>
                            <th style={{ textAlign: "center", padding: "6px 4px", color: "#c9a84c", fontSize: "10px", letterSpacing: "1px" }}>SCORE</th>
                            <th style={{ textAlign: "center", padding: "6px 4px", color: "#c9a84c", fontSize: "10px", letterSpacing: "1px" }}>TODAY</th>
                            <th style={{ textAlign: "center", padding: "6px 4px", color: "#c9a84c", fontSize: "10px", letterSpacing: "1px" }}>THRU</th>
                            {hasScorecards && <th style={{ textAlign: "center", padding: "6px 4px", color: "#c9a84c", fontSize: "10px", letterSpacing: "1px" }}>EGL/BOG+</th>}
                            <th style={{ textAlign: "center", padding: "6px 4px", color: "#c9a84c", fontSize: "10px", letterSpacing: "1px" }}>STATUS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {player.golferDetails.map((gd, gi) => (
                            <tr key={gi} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", opacity: gd.live?.isCut ? 0.5 : 1 }}>
                              <td style={{ padding: "7px 4px", color: "#f5e6c8" }}>
                                {gd.live?.name || gd.pickName}
                                {!gd.found && <span style={{ color: "#e05c5c", fontSize: "10px", marginLeft: "4px" }}>*</span>}
                              </td>
                              <td style={{ textAlign: "center", padding: "7px 4px", color: "#a8c5a0", ...s.mono }}>{gd.live?.position || "--"}</td>
                              <td style={{ textAlign: "center", padding: "7px 4px", color: scoreColor(gd.live?.scoreToPar), fontWeight: "bold", ...s.mono }}>{gd.found ? formatScore(gd.live.scoreToPar) : "--"}</td>
                              <td style={{ textAlign: "center", padding: "7px 4px", color: scoreColor(gd.live?.today), ...s.mono }}>{gd.live?.today != null ? formatScore(gd.live.today) : "--"}</td>
                              <td style={{ textAlign: "center", padding: "7px 4px", color: "#a8c5a0", ...s.mono }}>{gd.live?.thru || "--"}</td>
                              {hasScorecards && (
                                <td style={{ textAlign: "center", padding: "7px 4px", ...s.mono, fontSize: "11px" }}>
                                  <span style={{ color: "#6bcf7f" }}>{gd.live?.eagles ?? "-"}</span>
                                  {" / "}
                                  <span style={{ color: "#e05c5c" }}>{gd.live?.bogeyPlus ?? "-"}</span>
                                </td>
                              )}
                              <td style={{ textAlign: "center", padding: "7px 4px" }}>
                                {gd.live?.isCut ? (
                                  <span style={{ color: "#e05c5c", fontSize: "10px", background: "rgba(224,92,92,0.15)", borderRadius: "3px", padding: "2px 6px" }}>CUT</span>
                                ) : gd.found ? (
                                  <span style={{ color: "#6bcf7f", fontSize: "10px", background: "rgba(107,207,127,0.15)", borderRadius: "3px", padding: "2px 6px" }}>ACTIVE</span>
                                ) : (
                                  <span style={{ color: "#a8c5a0", fontSize: "10px" }}>--</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {player.golferDetails.some((g) => !g.found) && (
                        <p style={{ fontSize: "10px", color: "#a8c5a0", marginTop: "8px", marginBottom: 0 }}>* Golfer not found in tournament field — scored as E (even par)</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === "rosters" && (
            <div>
              <p style={{ color: "#a8c5a0", fontSize: "13px", marginTop: 0, marginBottom: "16px" }}>Each player&apos;s 9 golfer picks for The Masters 2026.</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
                {POOL_PLAYERS.map((player) => {
                  const standing = sorted.find((s) => s.name === player.name);
                  const rank = sorted.findIndex((s) => s.name === player.name) + 1;
                  return (
                    <div key={player.name} style={s.card}>
                      <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(201,168,76,0.1)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div>
                          <span style={{ fontSize: "16px", fontWeight: "bold", color: "#c9a84c" }}>{player.name}</span>
                          <span style={{ fontSize: "12px", color: "#a8c5a0", marginLeft: "8px" }}>#{rank}</span>
                        </div>
                        <div style={{ fontSize: "18px", fontWeight: "bold", color: scoreColor(standing?.totalScore), ...s.mono }}>{standing ? formatScore(standing.totalScore) : "--"}</div>
                      </div>
                      <div style={{ padding: "10px 16px" }}>
                        {player.golfers.map((g, i) => {
                          const live = matchGolfer(g, espnGolfers);
                          return (
                            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: i < player.golfers.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", opacity: live?.isCut ? 0.5 : 1 }}>
                              <span style={{ fontSize: "13px", color: live?.isCut ? "#a8c5a0" : "#f5e6c8" }}>
                                {g}{live?.isCut && <span style={{ fontSize: "10px", color: "#e05c5c", marginLeft: "6px" }}>CUT</span>}
                              </span>
                              <span style={{ fontSize: "13px", fontWeight: "bold", color: scoreColor(live?.scoreToPar), ...s.mono }}>{live ? formatScore(live.scoreToPar) : "--"}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "golfers" && (
            <div>
              <p style={{ color: "#a8c5a0", fontSize: "13px", marginTop: 0, marginBottom: "16px" }}>Full tournament leaderboard — live from ESPN.</p>
              {espnGolfers.length === 0 ? (
                <p style={{ color: "#a8c5a0" }}>No leaderboard data available yet.</p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid rgba(201,168,76,0.4)" }}>
                        <th style={{ textAlign: "left", padding: "10px 6px", color: "#c9a84c", fontSize: "10px", letterSpacing: "1px" }}>POS</th>
                        <th style={{ textAlign: "left", padding: "10px 6px", color: "#c9a84c", fontSize: "10px", letterSpacing: "1px" }}>GOLFER</th>
                        <th style={{ textAlign: "center", padding: "10px 6px", color: "#c9a84c", fontSize: "10px", letterSpacing: "1px" }}>TOTAL</th>
                        <th style={{ textAlign: "center", padding: "10px 6px", color: "#c9a84c", fontSize: "10px", letterSpacing: "1px" }}>TODAY</th>
                        <th style={{ textAlign: "center", padding: "10px 6px", color: "#c9a84c", fontSize: "10px", letterSpacing: "1px" }}>THRU</th>
                        <th style={{ textAlign: "center", padding: "10px 6px", color: "#c9a84c", fontSize: "10px", letterSpacing: "1px" }}>PICKED BY</th>
                      </tr>
                    </thead>
                    <tbody>
                      {espnGolfers.sort((a, b) => a.scoreToPar - b.scoreToPar).map((golfer, i) => {
                        const pickedBy = POOL_PLAYERS.filter((p) => p.golfers.some((g) => matchGolfer(g, [golfer]))).map((p) => p.name);
                        return (
                          <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent", opacity: golfer.isCut ? 0.5 : 1 }}>
                            <td style={{ padding: "8px 6px", color: "#a8c5a0", ...s.mono, fontSize: "12px" }}>{golfer.position || i + 1}</td>
                            <td style={{ padding: "8px 6px", color: "#f5e6c8" }}>{golfer.name}{golfer.isCut && <span style={{ fontSize: "10px", color: "#e05c5c", marginLeft: "6px" }}>CUT</span>}</td>
                            <td style={{ textAlign: "center", padding: "8px 6px", fontWeight: "bold", color: scoreColor(golfer.scoreToPar), ...s.mono }}>{formatScore(golfer.scoreToPar)}</td>
                            <td style={{ textAlign: "center", padding: "8px 6px", color: scoreColor(golfer.today), ...s.mono }}>{golfer.today != null ? formatScore(golfer.today) : "--"}</td>
                            <td style={{ textAlign: "center", padding: "8px 6px", color: "#a8c5a0", ...s.mono }}>{golfer.thru || "--"}</td>
                            <td style={{ textAlign: "center", padding: "8px 6px" }}>
                              {pickedBy.length > 0 ? (
                                <span style={{ fontSize: "11px", color: "#c9a84c", background: "rgba(201,168,76,0.1)", borderRadius: "3px", padding: "2px 6px" }}>{pickedBy.join(", ")}</span>
                              ) : (
                                <span style={{ fontSize: "11px", color: "rgba(168,197,160,0.3)" }}>—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ textAlign: "center", padding: "24px 20px", color: "rgba(168,197,160,0.4)", fontSize: "11px" }}>
          <div style={{ letterSpacing: "3px", marginBottom: "4px" }}>A TRADITION UNLIKE ANY OTHER</div>
          <div>Auto-updates every 60s &middot; Scores via ESPN{hasScorecards && " + Masters.com"}</div>
        </div>
      </div>
    </>
  );
}
