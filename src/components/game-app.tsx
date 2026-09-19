"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { buildFallbackResult } from "@/lib/fallback-judge";
import type {
  GamePhase,
  JudgeEntry,
  JudgeResponse,
  LanguageCode,
  Player,
  PlayerId,
  ScoreBreakdown,
} from "@/types/game";

import { ArrowIcon, MicIcon, RefreshIcon, TrophyIcon } from "./icons";

const TURN_SECONDS = 15;
const COUNTDOWN_SECONDS = 3;

const initialPlayers: Player[] = [
  { id: "A", name: "Player A", language: "en-US", transcripts: [], roundScores: [] },
  { id: "B", name: "Player B", language: "en-US", transcripts: [], roundScores: [] },
];

function totalScore(player: Player) {
  return player.roundScores.reduce((total, score) => total + score, 0);
}

function PlayerCard({
  player,
  active,
  round,
  result,
}: {
  player: Player;
  active: boolean;
  round: number;
  result?: ScoreBreakdown;
}) {
  return (
    <article className={`player-card player-${player.id.toLowerCase()} ${active ? "is-active" : ""}`}>
      <div className="player-card-top">
        <div>
          <span className="eyebrow">PLAYER {player.id}</span>
          <h2>{player.name}</h2>
        </div>
        <span className={`player-state ${active ? "is-live" : ""}`}>
          <i /> {active ? "ON MIC" : "STANDBY"}
        </span>
      </div>
      <div className="score-row">
        <div><span>Match total</span><strong>{totalScore(player)}</strong></div>
        <div><span>Round {round}</span><strong>{result?.total ?? "—"}</strong></div>
      </div>
    </article>
  );
}

function SetupScreen({ onStart }: { onStart: (players: Player[]) => void }) {
  const [names, setNames] = useState(["", ""]);
  const [languages, setLanguages] = useState<LanguageCode[]>(["en-US", "en-US"]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    onStart(
      initialPlayers.map((player, index) => ({
        ...player,
        name: names[index].trim() || `Player ${player.id}`,
        language: languages[index],
      })),
    );
  };

  return (
    <main className="setup-page">
      <header className="setup-header">
        <div className="wordmark">HYPE CHECK</div>
        <span>VINTELLIGENCE · CLUB FAIR</span>
      </header>

      <section className="setup-hero">
        <span className="eyebrow">TWO PLAYERS · TWO ROUNDS · FIFTEEN SECONDS</span>
        <h1>SELL US<br />THE DREAM.</h1>
        <p>Pitch Vintelligence like it is the smartest room on campus. The sharper, more specific, and more outrageous your hype, the higher the score.</p>
      </section>

      <form className="setup-form" onSubmit={submit}>
        <div className="setup-form-heading">
          <span className="eyebrow">MATCH SETUP</span>
          <h2>Who is stepping up?</h2>
        </div>
        <div className="setup-fields">
          {initialPlayers.map((player, index) => (
            <fieldset key={player.id} className={`player-input player-input-${player.id.toLowerCase()}`}>
              <legend>PLAYER {player.id}</legend>
              <label>
                <span>Player name</span>
                <input
                  value={names[index]}
                  onChange={(event) => {
                    const next = [...names];
                    next[index] = event.target.value;
                    setNames(next);
                  }}
                  placeholder={`Player ${player.id}`}
                  maxLength={24}
                />
              </label>
              <label>
                <span>Speech language</span>
                <select
                  value={languages[index]}
                  onChange={(event) => {
                    const next = [...languages];
                    next[index] = event.target.value as LanguageCode;
                    setLanguages(next);
                  }}
                >
                  <option value="en-US">English</option>
                  <option value="vi-VN">Vietnamese</option>
                </select>
              </label>
            </fieldset>
          ))}
        </div>
        <div className="setup-footer">
          <p>Chrome and an external microphone are recommended.</p>
          <button className="primary-button" type="submit">
            START MATCH <ArrowIcon size={20} />
          </button>
        </div>
      </form>
    </main>
  );
}

function ScoreDetails({ score }: { score: ScoreBreakdown }) {
  const items = [
    ["Creativity", score.creativity, 30],
    ["Delivery", score.eloquence, 25],
    ["Specificity", score.specificity, 25],
    ["Hype", score.flattery, 20],
  ] as const;

  return (
    <div className="score-details">
      {items.map(([label, value, max]) => (
        <div className="metric" key={label}>
          <div><span>{label}</span><b>{value}/{max}</b></div>
          <div className="metric-track"><i style={{ width: `${(value / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

export default function GameApp() {
  const [phase, setPhase] = useState<GamePhase>("setup");
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [round, setRound] = useState(1);
  const [activeIndex, setActiveIndex] = useState(0);
  const [seconds, setSeconds] = useState(TURN_SECONDS);
  const [draftTranscript, setDraftTranscript] = useState("");
  const [roundResult, setRoundResult] = useState<JudgeResponse | null>(null);
  const [judgeError, setJudgeError] = useState<string | null>(null);
  const [judgeConfigured, setJudgeConfigured] = useState<boolean | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const phaseRef = useRef<GamePhase>(phase);

  const activePlayer = players[activeIndex];
  const {
    transcript: speechTranscript,
    error: speechError,
    start: startSpeech,
    stop: stopSpeech,
    reset: resetSpeech,
    getTranscript,
  } = useSpeechRecognition(activePlayer?.language ?? "vi-VN");

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    fetch("/api/judge")
      .then((response) => response.json())
      .then((data: { configured?: boolean }) => setJudgeConfigured(Boolean(data.configured)))
      .catch(() => setJudgeConfigured(false));
  }, []);

  const beginSpeaking = useCallback(() => {
    setSeconds(TURN_SECONDS);
    setPhase("speaking");
    startSpeech();
  }, [startSpeech]);

  useEffect(() => {
    if (phase !== "countdown") return;
    let remaining = COUNTDOWN_SECONDS;
    const interval = window.setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        window.clearInterval(interval);
        beginSpeaking();
      } else setSeconds(remaining);
    }, 1_000);
    return () => window.clearInterval(interval);
  }, [beginSpeaking, phase]);

  const finishSpeaking = useCallback(() => {
    stopSpeech();
    window.setTimeout(() => {
      setDraftTranscript(getTranscript());
      setPhase("review");
    }, 450);
  }, [getTranscript, stopSpeech]);

  useEffect(() => {
    if (phase !== "speaking") return;
    let remaining = TURN_SECONDS;
    const interval = window.setInterval(() => {
      remaining -= 1;
      setSeconds(Math.max(remaining, 0));
      if (remaining <= 0) {
        window.clearInterval(interval);
        finishSpeaking();
      }
    }, 1_000);
    return () => window.clearInterval(interval);
  }, [finishSpeaking, phase]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat) return;
      if (["INPUT", "TEXTAREA", "SELECT"].includes((event.target as HTMLElement).tagName)) return;
      event.preventDefault();
      if (phaseRef.current === "ready") {
        resetSpeech();
        setDraftTranscript("");
        setSeconds(COUNTDOWN_SECONDS);
        setPhase("countdown");
      }
      if (phaseRef.current === "speaking") finishSpeaking();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [finishSpeaking, resetSpeech]);

  const currentEntries = useCallback(
    (sourcePlayers = players): JudgeEntry[] =>
      sourcePlayers.map((player) => ({ id: player.id, text: player.transcripts[round - 1] ?? "" })),
    [players, round],
  );

  const applyJudgeResult = useCallback((result: JudgeResponse) => {
    setRoundResult(result);
    setPlayers((current) =>
      current.map((player) => {
        const score = result.players.find((item) => item.id === player.id);
        const roundScores = [...player.roundScores];
        roundScores[result.round - 1] = score?.total ?? 0;
        return { ...player, roundScores };
      }),
    );
    setJudgeError(null);
    setPhase("round-result");
  }, []);

  const judgeRound = useCallback(
    async (sourcePlayers: Player[], forceFallback = false) => {
      setPhase("judging");
      setJudgeError(null);
      const entries = currentEntries(sourcePlayers);
      try {
        const response = await fetch(`/api/judge${forceFallback ? "?fallback=1" : ""}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ round, entries }),
        });
        const data = (await response.json()) as JudgeResponse & { error?: string };
        if (!response.ok) throw new Error(data.error || "The AI judge did not respond.");
        applyJudgeResult(data);
      } catch (error) {
        setJudgeError(error instanceof Error ? error.message : "Could not reach the AI judge.");
      }
    },
    [applyJudgeResult, currentEntries, round],
  );

  const startGame = (nextPlayers: Player[]) => {
    setPlayers(nextPlayers);
    setRound(1);
    setActiveIndex(0);
    setRoundResult(null);
    setJudgeError(null);
    setPhase("ready");
  };

  const startTurn = () => {
    resetSpeech();
    setDraftTranscript("");
    setSeconds(COUNTDOWN_SECONDS);
    setPhase("countdown");
  };

  const confirmTranscript = () => {
    const nextPlayers = players.map((player, index) => {
      if (index !== activeIndex) return player;
      const transcripts = [...player.transcripts];
      transcripts[round - 1] = draftTranscript.trim();
      return { ...player, transcripts };
    });
    setPlayers(nextPlayers);

    if (activeIndex === 0) {
      setActiveIndex(1);
      resetSpeech();
      setDraftTranscript("");
      setPhase("ready");
    } else void judgeRound(nextPlayers);
  };

  const useLocalFallback = () => {
    applyJudgeResult(
      buildFallbackResult(
        round,
        currentEntries(),
        "The server could not be reached, so this round was scored by the on-device backup judge.",
      ),
    );
  };

  const continueGame = () => {
    if (round < 2) {
      setRound(2);
      setActiveIndex(0);
      setRoundResult(null);
      resetSpeech();
      setDraftTranscript("");
      setPhase("ready");
    } else setPhase("final-result");
  };

  const resetGame = () => {
    stopSpeech();
    resetSpeech();
    setPlayers(initialPlayers);
    setRound(1);
    setActiveIndex(0);
    setRoundResult(null);
    setJudgeError(null);
    setDraftTranscript("");
    setPhase("setup");
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
      setIsFullscreen(Boolean(document.fullscreenElement));
    } catch {
      setIsFullscreen(false);
    }
  };

  const finalWinner = useMemo(() => {
    const [playerA, playerB] = players;
    if (totalScore(playerA) === totalScore(playerB)) return null;
    return totalScore(playerA) > totalScore(playerB) ? playerA : playerB;
  }, [players]);

  if (phase === "setup") return <SetupScreen onStart={startGame} />;

  const resultFor = (id: PlayerId) => roundResult?.players.find((score) => score.id === id);
  const progress = phase === "speaking" ? ((TURN_SECONDS - seconds) / TURN_SECONDS) * 100 : 0;
  const arenaPhase = ["ready", "countdown", "speaking"].includes(phase);

  return (
    <main className="game-shell">
      <header className="game-header">
        <button className="brand-button" type="button" onClick={resetGame} aria-label="Return to match setup">
          <b>HYPE CHECK</b>
          <small>VINTELLIGENCE CLUB FAIR</small>
        </button>
        <div className="match-status">
          <span>MATCH STATUS</span>
          <b>ROUND {round} / 2</b>
        </div>
        <div className="header-actions">
          <span className={`status-chip ${judgeConfigured ? "online" : "backup"}`}>
            <i /> {judgeConfigured ? "AI JUDGE ONLINE" : "BACKUP READY"}
          </span>
          <button className="ghost-button" type="button" onClick={toggleFullscreen}>
            {isFullscreen ? "EXIT FULLSCREEN" : "FULLSCREEN"}
          </button>
        </div>
      </header>

      <section className="round-nav" aria-label="Match progress">
        {[1, 2].map((item) => (
          <div key={item} className={item === round ? "current" : item < round ? "done" : ""}>
            <span>{item < round ? "✓" : item}</span><b>ROUND {item}</b>
          </div>
        ))}
        <div className={phase === "final-result" ? "current" : ""}>
          <span><TrophyIcon size={15} /></span><b>CHAMPION</b>
        </div>
      </section>

      {phase === "final-result" ? (
        <section className="final-panel">
          <div className="confetti" aria-hidden="true">
            {Array.from({ length: 28 }).map((_, index) => <i key={index} />)}
          </div>
          <span className="eyebrow">FINAL VERDICT</span>
          <h1>{finalWinner ? "HYPE CHAMPION" : "DEAD EVEN"}</h1>
          <p className="winner-name">{finalWinner?.name ?? `${players[0].name} × ${players[1].name}`}</p>
          <div className="final-score">
            <div><span>{players[0].name}</span><strong>{totalScore(players[0])}</strong></div>
            <b>—</b>
            <div><span>{players[1].name}</span><strong>{totalScore(players[1])}</strong></div>
          </div>
          <p className="final-line">
            {finalWinner
              ? "The pitch was sharp, specific, and impossible to ignore. The judge has spoken."
              : "Two elite pitches, one impossible decision. Even the judge is calling it a tie."}
          </p>
          <button className="primary-button compact" type="button" onClick={resetGame}>
            <RefreshIcon size={19} /> NEW MATCH
          </button>
        </section>
      ) : (
        <>
          {arenaPhase && (
            <>
              <section className="arena">
                <PlayerCard
                  player={players[0]}
                  active={activeIndex === 0}
                  round={round}
                  result={resultFor("A")}
                />

                <section className={`arena-center phase-${phase}`}>
                  {phase === "ready" && (
                    <>
                      <span className="eyebrow">PLAYER {activePlayer.id} · UP NEXT</span>
                      <h1>{activePlayer.name}</h1>
                      <p>Fifteen seconds to make Vintelligence sound legendary.</p>
                      <button className="primary-button compact" type="button" onClick={startTurn}>
                        <MicIcon size={19} /> START TURN
                      </button>
                      <small>Press SPACE · {activePlayer.language === "vi-VN" ? "Vietnamese" : "English"}</small>
                    </>
                  )}

                  {phase === "countdown" && (
                    <>
                      <span className="eyebrow">GET READY, {activePlayer.name.toUpperCase()}</span>
                      <div className="countdown-number" key={seconds}>{seconds}</div>
                      <p>Bring the microphone close. Your time starts now.</p>
                    </>
                  )}

                  {phase === "speaking" && (
                    <>
                      <div className="speaking-top">
                        <span className="live-title"><i /> LIVE</span>
                        <strong className={seconds <= 5 ? "urgent" : ""}>{String(seconds).padStart(2, "0")}</strong>
                      </div>
                      <div className="timer-track"><i style={{ width: `${progress}%` }} /></div>
                      <div className="live-transcript" aria-live="polite">
                        {speechTranscript || <span>Start your pitch…</span>}
                      </div>
                      {speechError && <p className="inline-warning">{speechError}</p>}
                      <button className="stop-button" type="button" onClick={finishSpeaking}>FINISH TURN</button>
                    </>
                  )}
                </section>

                <PlayerCard
                  player={players[1]}
                  active={activeIndex === 1}
                  round={round}
                  result={resultFor("B")}
                />
              </section>
              <div className="prompt-bar">
                <div><span className="eyebrow">THE PROMPT</span><strong>Why is Vintelligence the smartest room on campus?</strong></div>
                <span>ROUND {round} · PLAYER {activePlayer.id}</span>
              </div>
            </>
          )}

          {phase === "review" && (
            <section className="stage-panel review-panel">
              <span className="eyebrow">TRANSCRIPT CHECK · PLAYER {activePlayer.id}</span>
              <h1>Here is what we heard.</h1>
              <p>Fix any words the microphone missed before sending this pitch to the judge.</p>
              <textarea
                autoFocus
                value={draftTranscript}
                onChange={(event) => setDraftTranscript(event.target.value.slice(0, 1_200))}
                placeholder="Type the pitch here if the microphone missed it…"
                rows={5}
              />
              <div className="review-footer">
                <span>{draftTranscript.length}/1200 characters</span>
                <div>
                  <button className="ghost-button" type="button" onClick={startTurn}>TRY AGAIN</button>
                  <button className="primary-button compact" type="button" onClick={confirmTranscript}>
                    CONFIRM <ArrowIcon size={18} />
                  </button>
                </div>
              </div>
            </section>
          )}

          {phase === "judging" && (
            <section className="stage-panel judging-panel">
              {!judgeError ? (
                <>
                  <div className="ai-loader"><span /><span /><span /></div>
                  <span className="eyebrow">THE JUDGE IS WORKING</span>
                  <h1>Running the hype check.</h1>
                  <p>Creativity · delivery · specificity · hype</p>
                </>
              ) : (
                <>
                  <span className="error-symbol">!</span>
                  <span className="eyebrow">THE JUDGE DROPPED THE BALL</span>
                  <h1>No score yet.</h1><p>{judgeError}</p>
                  <div className="error-actions">
                    <button className="ghost-button" type="button" onClick={() => void judgeRound(players)}>TRY AGAIN</button>
                    <button className="primary-button compact" type="button" onClick={useLocalFallback}>USE BACKUP JUDGE</button>
                  </div>
                </>
              )}
            </section>
          )}

          {phase === "round-result" && roundResult && (
            <section className="result-panel">
              <div className="result-heading">
                <div><span className="eyebrow">ROUND {round} VERDICT</span><h1>{roundResult.winner === "tie" ? "This one is a tie." : `${players.find((player) => player.id === roundResult.winner)?.name} takes the round.`}</h1></div>
                <span className={`judge-mode ${roundResult.mode}`}>
                  {roundResult.mode === "openai" ? "OPENAI JUDGE" : "BACKUP JUDGE"}
                </span>
              </div>
              <div className="result-grid">
                {players.map((player) => {
                  const score = resultFor(player.id);
                  const won = roundResult.winner === player.id;
                  if (!score) return null;
                  return (
                    <article key={player.id} className={`result-card result-${player.id.toLowerCase()} ${won ? "winner" : ""}`}>
                      {won && <span className="winner-ribbon"><TrophyIcon size={14} /> ROUND WINNER</span>}
                      <span className="eyebrow">PLAYER {player.id}</span><h2>{player.name}</h2>
                      <div className="big-score"><strong>{score.total}</strong><span>/100</span></div>
                      <ScoreDetails score={score} />
                      <blockquote>“{score.comment}”</blockquote>
                    </article>
                  );
                })}
              </div>
              {roundResult.warning && <p className="mode-warning">{roundResult.warning}</p>}
              <button className="primary-button compact result-next" type="button" onClick={continueGame}>
                {round < 2 ? "START ROUND 2" : "SEE THE CHAMPION"} <ArrowIcon size={19} />
              </button>
            </section>
          )}
        </>
      )}
    </main>
  );
}
