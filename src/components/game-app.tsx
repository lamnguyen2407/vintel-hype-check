"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { buildFallbackResult } from "@/lib/fallback-judge";
import { createQuestionSet, getQuestionById } from "@/lib/game-config";
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

const ROUND_SECONDS: Record<number, number> = { 1: 20, 2: 20, 3: 30 };
const COUNTDOWN_SECONDS = 3;
const TOTAL_ROUNDS = 3;

const initialPlayers: Player[] = [
  { id: "A", name: "Player A", language: "vi-VN", transcripts: [], roundResults: [] },
  { id: "B", name: "Player B", language: "vi-VN", transcripts: [], roundResults: [] },
];

function totalScore(player: Player) {
  return player.roundResults.reduce((total, score) => total + (score?.total ?? 0), 0);
}

function scoreForRound(player: Player, round: number) {
  return player.roundResults[round - 1]?.total ?? 0;
}

function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand-lockup ${compact ? "compact" : ""}`}>
      <Image src="/vinuni-logo.png" alt="VinUniversity" width={270} height={166} priority />
      <span aria-hidden="true" />
      <Image src="/vintelligence-logo.png" alt="Vintelligence" width={300} height={300} priority />
    </div>
  );
}

function PixelField() {
  return (
    <div className="pixel-field" aria-hidden="true">
      {Array.from({ length: 18 }, (_, index) => <i key={index} />)}
    </div>
  );
}

function PlayerCard({ player, active, round }: { player: Player; active: boolean; round: number }) {
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
        <div><span>Round {round}</span><strong>{scoreForRound(player, round) || "—"}</strong></div>
      </div>
    </article>
  );
}

function SetupScreen({ onStart }: { onStart: (players: Player[]) => void }) {
  const [names, setNames] = useState(["", ""]);
  const [languages, setLanguages] = useState<LanguageCode[]>(["vi-VN", "vi-VN"]);

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
      <PixelField />
      <header className="setup-header">
        <div className="wordmark">HYPE CHECK</div>
        <BrandLockup compact />
      </header>

      <section className="setup-hero">
        <span className="event-tag">VINTELLIGENCE · CLUB FAIR 2026</span>
        <h1>HYPE<br /><em>CHECK</em></h1>
        <p>Think fast. Speak clearly. Finish with the most shameless Vintelligence hype the room has ever heard.</p>
        <div className="hero-specs">
          <span>02 PLAYERS</span><span>03 ROUNDS</span><span>20 / 20 / 30 SEC</span>
        </div>
      </section>

      <section className="round-preview" aria-label="Game format">
        <article><b>01</b><div><span>AI KNOWLEDGE</span><p>A simple open question about AI in everyday life.</p></div></article>
        <article><b>02</b><div><span>ML EXPLAINER</span><p>Make one machine-learning idea easy to understand.</p></div></article>
        <article className="hype"><b>03</b><div><span>SHAMELESS HYPE</span><p>Funny, original, outrageous Vintelligence flattery.</p></div></article>
      </section>

      <form className="setup-form" onSubmit={submit}>
        <div className="setup-form-heading">
          <div><span className="eyebrow">MATCH SETUP</span><h2>ENTER THE GRID</h2></div>
          <p>Speech recognition defaults to Vietnamese. Questions and interface stay in English.</p>
        </div>
        <div className="setup-fields">
          {initialPlayers.map((player, index) => (
            <fieldset key={player.id} className="player-input">
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
                  <option value="vi-VN">Vietnamese</option>
                  <option value="en-US">English</option>
                </select>
              </label>
            </fieldset>
          ))}
        </div>
        <div className="setup-footer">
          <p><i /> NOISE-FILTERED MIC · ADVANCED TRANSCRIPTION · AI JUDGE</p>
          <button className="primary-button" type="submit">START MATCH <ArrowIcon size={20} /></button>
        </div>
      </form>
    </main>
  );
}

function ScoreDetails({ score }: { score: ScoreBreakdown }) {
  return (
    <div className="score-details">
      {score.metrics.map((metric) => (
        <div className="metric" key={metric.key}>
          <div><span>{metric.label}</span><b>{metric.score}/{metric.max}</b></div>
          <div className="metric-track"><i style={{ width: `${(metric.score / metric.max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

export default function GameApp() {
  const [phase, setPhase] = useState<GamePhase>("setup");
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [questionIds, setQuestionIds] = useState<string[]>(["ai-everyday-problem", "ml-ten-year-old", "vintel-hype"]);
  const [round, setRound] = useState(1);
  const [activeIndex, setActiveIndex] = useState(0);
  const [seconds, setSeconds] = useState(ROUND_SECONDS[1]);
  const [draftTranscript, setDraftTranscript] = useState("");
  const [transcriptionNotice, setTranscriptionNotice] = useState<string | null>(null);
  const [roundResult, setRoundResult] = useState<JudgeResponse | null>(null);
  const [judgeError, setJudgeError] = useState<string | null>(null);
  const [judgeConfigured, setJudgeConfigured] = useState<boolean | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const phaseRef = useRef<GamePhase>(phase);
  const finishingRef = useRef(false);

  const activePlayer = players[activeIndex];
  const activeQuestion = getQuestionById(questionIds[round - 1], round) ?? getQuestionById("vintel-hype")!;
  const turnDuration = ROUND_SECONDS[round] ?? ROUND_SECONDS[1];
  const {
    transcript: speechTranscript,
    error: speechError,
    start: startSpeech,
    stop: stopSpeech,
    reset: resetSpeech,
  } = useSpeechRecognition(activePlayer?.language ?? "vi-VN");

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  useEffect(() => {
    fetch("/api/judge")
      .then((response) => response.json())
      .then((data: { configured?: boolean }) => setJudgeConfigured(Boolean(data.configured)))
      .catch(() => setJudgeConfigured(false));
  }, []);

  const beginSpeaking = useCallback(() => {
    setSeconds(turnDuration);
    setPhase("speaking");
  }, [turnDuration]);

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

  const finishSpeaking = useCallback(async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setPhase("transcribing");
    setTranscriptionNotice(null);

    try {
      const capture = await stopSpeech();
      let transcript = capture.liveTranscript;

      if (capture.audio) {
        try {
          const form = new FormData();
          const extension = capture.audio.type.includes("mp4") ? "m4a" : "webm";
          form.append("audio", capture.audio, `hype-check.${extension}`);
          form.append("language", activePlayer.language);
          form.append("question", activeQuestion.prompt);
          form.append("liveTranscript", capture.liveTranscript.slice(0, 1_200));
          const response = await fetch("/api/transcribe", { method: "POST", body: form });
          const data = (await response.json()) as { text?: string; error?: string };
          if (!response.ok || !data.text) throw new Error(data.error || "Transcription failed.");
          transcript = data.text;
        } catch {
          setTranscriptionNotice("Advanced transcription was unavailable, so the live transcript was used. Please check it before confirming.");
        }
      } else {
        setTranscriptionNotice("No high-quality recording was captured. Please check or type the answer manually.");
      }

      setDraftTranscript(transcript);
      setPhase("review");
    } finally {
      finishingRef.current = false;
    }
  }, [activePlayer.language, activeQuestion.prompt, stopSpeech]);

  useEffect(() => {
    if (phase !== "speaking") return;
    let remaining = turnDuration;
    const interval = window.setInterval(() => {
      remaining -= 1;
      setSeconds(Math.max(remaining, 0));
      if (remaining <= 0) {
        window.clearInterval(interval);
        void finishSpeaking();
      }
    }, 1_000);
    return () => window.clearInterval(interval);
  }, [finishSpeaking, phase, turnDuration]);

  const startTurn = useCallback(async () => {
    resetSpeech();
    setDraftTranscript("");
    setTranscriptionNotice(null);
    await startSpeech();
    setSeconds(COUNTDOWN_SECONDS);
    setPhase("countdown");
  }, [resetSpeech, startSpeech]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat) return;
      if (["INPUT", "TEXTAREA", "SELECT"].includes((event.target as HTMLElement).tagName)) return;
      event.preventDefault();
      if (phaseRef.current === "ready") void startTurn();
      if (phaseRef.current === "speaking") void finishSpeaking();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [finishSpeaking, startTurn]);

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
        const roundResults = [...player.roundResults];
        if (score) roundResults[result.round - 1] = score;
        return { ...player, roundResults };
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
      const questionId = questionIds[round - 1];
      try {
        const response = await fetch(`/api/judge${forceFallback ? "?fallback=1" : ""}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ round, questionId, entries }),
        });
        const data = (await response.json()) as JudgeResponse & { error?: string };
        if (!response.ok) throw new Error(data.error || "The AI judge did not respond.");
        applyJudgeResult(data);
      } catch (error) {
        setJudgeError(error instanceof Error ? error.message : "Could not reach the AI judge.");
      }
    },
    [applyJudgeResult, currentEntries, questionIds, round],
  );

  const startGame = (nextPlayers: Player[]) => {
    setPlayers(nextPlayers);
    setQuestionIds(createQuestionSet());
    setRound(1);
    setActiveIndex(0);
    setRoundResult(null);
    setJudgeError(null);
    setPhase("ready");
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
        questionIds[round - 1],
        currentEntries(),
        "The server could not be reached, so this round was scored by the on-device backup judge.",
      ),
    );
  };

  const continueGame = () => {
    if (round < TOTAL_ROUNDS) {
      setRound((current) => current + 1);
      setActiveIndex(0);
      setRoundResult(null);
      resetSpeech();
      setDraftTranscript("");
      setPhase("ready");
    } else setPhase("final-result");
  };

  const resetGame = () => {
    void stopSpeech();
    resetSpeech();
    setPlayers(initialPlayers);
    setQuestionIds(["ai-everyday-problem", "ml-ten-year-old", "vintel-hype"]);
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
  const progress = phase === "speaking" ? ((turnDuration - seconds) / turnDuration) * 100 : 0;
  const arenaPhase = ["ready", "countdown", "speaking"].includes(phase);

  return (
    <main className="game-shell">
      <PixelField />
      <header className="game-header">
        <button className="brand-button" type="button" onClick={resetGame} aria-label="Return to match setup">
          <b>HYPE CHECK</b><small>VINTELLIGENCE · CLUB FAIR</small>
        </button>
        <BrandLockup compact />
        <div className="header-actions">
          <span className={`status-chip ${judgeConfigured ? "online" : "backup"}`}><i /> {judgeConfigured ? "AI SYSTEM ONLINE" : "BACKUP MODE"}</span>
          <button className="ghost-button home-button" type="button" onClick={resetGame} aria-label="Return to home screen">HOME</button>
          <button className="ghost-button" type="button" onClick={toggleFullscreen}>{isFullscreen ? "EXIT" : "FULLSCREEN"}</button>
        </div>
      </header>

      <section className="round-nav" aria-label="Match progress">
        {[1, 2, 3].map((item) => (
          <div key={item} className={item === round ? "current" : item < round ? "done" : ""}>
            <span>{item < round ? "✓" : `0${item}`}</span><b>{item === 3 ? "HYPE ROUND" : `ROUND ${item}`}</b>
          </div>
        ))}
        <div className={phase === "final-result" ? "current" : ""}><span><TrophyIcon size={15} /></span><b>FINAL</b></div>
      </section>

      {phase === "final-result" ? (
        <section className="final-panel">
          <span className="eyebrow">FINAL SCOREBOARD</span>
          <h1>{finalWinner ? "GRID CHAMPION" : "SYSTEM TIE"}</h1>
          <p className="winner-name">{finalWinner?.name ?? `${players[0].name} × ${players[1].name}`}</p>

          <div className="scoreboard-wrap">
            <table className="final-scoreboard">
              <thead><tr><th>PLAYER</th><th>R1 · AI</th><th>R2 · ML</th><th>R3 · HYPE</th><th>TOTAL</th></tr></thead>
              <tbody>
                {players.map((player) => (
                  <tr key={player.id} className={finalWinner?.id === player.id ? "winner" : ""}>
                    <th><span>{player.id}</span>{player.name}</th>
                    {[1, 2, 3].map((item) => <td key={item}>{scoreForRound(player, item)}<small>/100</small></td>)}
                    <td className="total">{totalScore(player)}<small>/300</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="final-line">{finalWinner ? "Three rounds cleared. The grid has selected its champion." : "Perfectly balanced. Even the AI judge could not split the grid."}</p>
          <button className="primary-button" type="button" onClick={resetGame}><RefreshIcon size={19} /> NEW MATCH</button>
        </section>
      ) : (
        <>
          {arenaPhase && (
            <>
              <section className="question-banner">
                <div><span>ROUND 0{round} · {activeQuestion.label}</span><strong>{activeQuestion.prompt}</strong></div>
                <p>{activeQuestion.helper}</p>
              </section>
              <section className="arena">
                <PlayerCard player={players[0]} active={activeIndex === 0} round={round} />
                <section className={`arena-center phase-${phase}`}>
                  {phase === "ready" && (
                    <>
                      <span className="eyebrow">PLAYER {activePlayer.id} · READY</span>
                      <h1>{activePlayer.name}</h1>
                      <p>One question. {turnDuration} seconds. Make every word count.</p>
                      <button className="primary-button" type="button" onClick={() => void startTurn()}><MicIcon size={19} /> START TURN</button>
                      <small>SPACE TO START · {activePlayer.language === "vi-VN" ? "VIETNAMESE INPUT" : "ENGLISH INPUT"}</small>
                    </>
                  )}
                  {phase === "countdown" && (
                    <><span className="eyebrow">MIC LOCKED · GET READY</span><div className="countdown-number" key={seconds}>{seconds}</div><p>Your {turnDuration} seconds start now.</p></>
                  )}
                  {phase === "speaking" && (
                    <>
                      <div className="speaking-top"><span className="live-title"><i /> LIVE</span><strong className={seconds <= 5 ? "urgent" : ""}>{String(seconds).padStart(2, "0")}</strong></div>
                      <div className="timer-track"><i style={{ width: `${progress}%` }} /></div>
                      <div className="live-transcript" aria-live="polite">{speechTranscript || <span>Start speaking…</span>}</div>
                      {speechError && <p className="inline-warning">{speechError}</p>}
                      <button className="stop-button" type="button" onClick={() => void finishSpeaking()}>FINISH TURN</button>
                    </>
                  )}
                </section>
                <PlayerCard player={players[1]} active={activeIndex === 1} round={round} />
              </section>
              <div className="system-strip"><span>NOISE REDUCTION: ON</span><span>ADVANCED TRANSCRIPTION: {judgeConfigured ? "ON" : "LIVE FALLBACK"}</span><span>PLAYER {activePlayer.id} · ROUND {round}/3</span></div>
            </>
          )}

          {phase === "transcribing" && (
            <section className="stage-panel transcribing-panel"><div className="scan-loader"><i /></div><span className="eyebrow">CLEANING AUDIO · LOCKING VOCABULARY</span><h1>DECODING SPEECH</h1><p>Removing background noise and checking names like Vintelligence, Vintel, and VinUniversity.</p></section>
          )}

          {phase === "review" && (
            <section className="stage-panel review-panel">
              <span className="eyebrow">TRANSCRIPT CHECK · PLAYER {activePlayer.id}</span><h1>VERIFY THE SIGNAL</h1>
              <p>Advanced transcription has finished. Correct any remaining word before sending the answer to the judge.</p>
              {transcriptionNotice && <p className="mode-warning">{transcriptionNotice}</p>}
              <textarea autoFocus value={draftTranscript} onChange={(event) => setDraftTranscript(event.target.value.slice(0, 1_200))} placeholder="Type the answer here if the microphone missed it…" rows={5} />
              <div className="review-footer"><span>{draftTranscript.length}/1200 CHARACTERS</span><div><button className="ghost-button" type="button" onClick={() => void startTurn()}>TRY AGAIN</button><button className="primary-button" type="button" onClick={confirmTranscript}>CONFIRM <ArrowIcon size={18} /></button></div></div>
            </section>
          )}

          {phase === "judging" && (
            <section className="stage-panel judging-panel">
              {!judgeError ? (
                <><div className="ai-loader"><span /><span /><span /><span /></div><span className="eyebrow">CALIBRATED AI JUDGE</span><h1>SCORING THE SIGNAL</h1><p>{activeQuestion.rubric.map((item) => item.label).join(" · ")}</p></>
              ) : (
                <><span className="error-symbol">!</span><span className="eyebrow">JUDGE CONNECTION LOST</span><h1>NO SCORE YET</h1><p>{judgeError}</p><div className="error-actions"><button className="ghost-button" type="button" onClick={() => void judgeRound(players)}>TRY AGAIN</button><button className="primary-button" type="button" onClick={useLocalFallback}>USE BACKUP JUDGE</button></div></>
              )}
            </section>
          )}

          {phase === "round-result" && roundResult && (
            <section className="result-panel">
              <div className="result-heading"><div><span className="eyebrow">ROUND 0{round} VERDICT</span><h1>{roundResult.winner === "tie" ? "SYSTEM TIE" : `${players.find((player) => player.id === roundResult.winner)?.name} TAKES IT`}</h1></div><span className={`judge-mode ${roundResult.mode}`}>{roundResult.mode === "gemini" ? "GEMINI AI JUDGE" : "BACKUP JUDGE"}</span></div>
              <div className="result-grid">
                {players.map((player) => {
                  const score = resultFor(player.id);
                  const won = roundResult.winner === player.id;
                  if (!score) return null;
                  return (
                    <article key={player.id} className={`result-card ${won ? "winner" : ""}`}>
                      {won && <span className="winner-ribbon"><TrophyIcon size={14} /> ROUND WINNER</span>}
                      <span className="eyebrow">PLAYER {player.id}</span><h2>{player.name}</h2>
                      <div className="big-score"><strong>{score.total}</strong><span>/100</span></div>
                      <ScoreDetails score={score} /><blockquote>“{score.comment}”</blockquote>
                    </article>
                  );
                })}
              </div>
              {roundResult.warning && <p className="mode-warning">{roundResult.warning}</p>}
              <button className="primary-button result-next" type="button" onClick={continueGame}>{round < TOTAL_ROUNDS ? `START ROUND ${round + 1}` : "VIEW FINAL SCOREBOARD"} <ArrowIcon size={19} /></button>
            </section>
          )}
        </>
      )}
    </main>
  );
}
