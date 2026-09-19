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

import { ArrowIcon, MicIcon, RefreshIcon, SparklesIcon, TrophyIcon } from "./icons";

const TURN_SECONDS = 15;
const COUNTDOWN_SECONDS = 3;

const initialPlayers: Player[] = [
  { id: "A", name: "Player A", language: "vi-VN", transcripts: [], roundScores: [] },
  { id: "B", name: "Player B", language: "vi-VN", transcripts: [], roundScores: [] },
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
        <div className="player-avatar">{player.name.trim().charAt(0).toUpperCase() || player.id}</div>
        <div>
          <span className="eyebrow">PLAYER {player.id}</span>
          <h2>{player.name}</h2>
        </div>
        {active && <span className="live-pill"><i /> LIVE</span>}
      </div>
      <div className="score-row">
        <div><span>Tổng điểm</span><strong>{totalScore(player)}</strong></div>
        <div><span>Round {round}</span><strong>{result?.total ?? "—"}</strong></div>
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
    <main className="setup-shell">
      <section className="hero-copy">
        <div className="event-label"><SparklesIcon size={17} /> VINTELLIGENCE CLUB FAIR</div>
        <h1>KHEN <span>CLB</span></h1>
        <p className="hero-kicker">AI COMPLIMENT BATTLE</p>
        <p className="hero-description">
          15 giây. Hai người chơi. Một AI Judge.<br />
          Ai sẽ tung ra cú “nịnh” khiến cả mô hình cũng phải đỏ mặt?
        </p>
        <div className="rule-strip" aria-label="Luật chơi">
          <div><b>01</b><span>2 người chơi</span></div>
          <div><b>02</b><span>2 rounds</span></div>
          <div><b>03</b><span>15 giây/lượt</span></div>
          <div><b>04</b><span>AI chấm điểm</span></div>
        </div>
      </section>

      <form className="setup-card" onSubmit={submit}>
        <div className="setup-heading">
          <span className="mini-icon"><MicIcon size={21} /></span>
          <div><span className="eyebrow">MATCH SETUP</span><h2>Sẵn sàng đấu?</h2></div>
        </div>

        {initialPlayers.map((player, index) => (
          <fieldset key={player.id} className={`player-input player-input-${player.id.toLowerCase()}`}>
            <legend>PLAYER {player.id}</legend>
            <label>
              <span>Tên người chơi</span>
              <input
                value={names[index]}
                onChange={(event) => {
                  const next = [...names];
                  next[index] = event.target.value;
                  setNames(next);
                }}
                placeholder={`Nhập tên Player ${player.id}`}
                maxLength={24}
              />
            </label>
            <label>
              <span>Ngôn ngữ</span>
              <select
                value={languages[index]}
                onChange={(event) => {
                  const next = [...languages];
                  next[index] = event.target.value as LanguageCode;
                  setLanguages(next);
                }}
              >
                <option value="vi-VN">Tiếng Việt</option>
                <option value="en-US">English</option>
              </select>
            </label>
          </fieldset>
        ))}

        <button className="primary-button" type="submit">
          BẮT ĐẦU TRẬN ĐẤU <ArrowIcon size={20} />
        </button>
        <p className="setup-note">Khuyên dùng Google Chrome và microphone ngoài.</p>
      </form>
    </main>
  );
}

function ScoreDetails({ score }: { score: ScoreBreakdown }) {
  const items = [
    ["Sáng tạo", score.creativity, 30],
    ["Hoa mỹ", score.eloquence, 25],
    ["Đúng chủ đề", score.specificity, 25],
    ["Độ nịnh", score.flattery, 20],
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
        if (!response.ok) throw new Error(data.error || "AI Judge không phản hồi.");
        applyJudgeResult(data);
      } catch (error) {
        setJudgeError(error instanceof Error ? error.message : "Không thể kết nối AI Judge.");
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
        "Mất kết nối server — kết quả được tính bởi Backup Judge trên thiết bị.",
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

  return (
    <main className="game-shell">
      <header className="game-header">
        <button className="brand-button" type="button" onClick={resetGame} aria-label="Về màn hình chính">
          <span className="brand-mark">V</span>
          <span><b>VINTELLIGENCE</b><small>AI COMPLIMENT BATTLE</small></span>
        </button>
        <div className="header-actions">
          <span className={`status-chip ${judgeConfigured ? "online" : "backup"}`}>
            <i /> {judgeConfigured ? "AI JUDGE ONLINE" : "BACKUP READY"}
          </span>
          <button className="ghost-button" type="button" onClick={toggleFullscreen}>
            {isFullscreen ? "THOÁT FULLSCREEN" : "FULLSCREEN"}
          </button>
        </div>
      </header>

      <section className="round-nav" aria-label="Tiến trình trận đấu">
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
          <div className="trophy-orbit"><TrophyIcon size={58} /></div>
          <span className="eyebrow">FINAL RESULT</span>
          <h1>{finalWinner ? "NHÀ VÔ ĐỊCH" : "BẤT PHÂN THẮNG BẠI"}</h1>
          <p className="winner-name">{finalWinner?.name ?? `${players[0].name} × ${players[1].name}`}</p>
          <div className="final-score">
            <div><span>{players[0].name}</span><strong>{totalScore(players[0])}</strong></div>
            <b>—</b>
            <div><span>{players[1].name}</span><strong>{totalScore(players[1])}</strong></div>
          </div>
          <p className="final-line">
            {finalWinner
              ? "Cú nịnh đã được AI chứng nhận. Vintelligence xin ghi nhận tài năng này!"
              : "Hai cao thủ ngang tài ngang sức — AI Judge cũng phải xin hòa!"}
          </p>
          <button className="primary-button compact" type="button" onClick={resetGame}>
            <RefreshIcon size={19} /> TRẬN MỚI
          </button>
        </section>
      ) : (
        <>
          <section className="players-grid">
            {players.map((player, index) => (
              <PlayerCard
                key={player.id}
                player={player}
                active={index === activeIndex && ["ready", "countdown", "speaking", "review"].includes(phase)}
                round={round}
                result={resultFor(player.id)}
              />
            ))}
          </section>

          {phase === "ready" && (
            <section className="stage-panel ready-panel">
              <span className="round-badge">ROUND {round} · LƯỢT {activePlayer.id}</span>
              <div className="mic-orbit"><MicIcon size={42} /></div>
              <p>Tiếp theo</p><h1>{activePlayer.name}</h1>
              <p className="stage-copy">Bạn có 15 giây để khen Vintelligence và VinUniversity.</p>
              <button className="primary-button compact" type="button" onClick={startTurn}>
                <MicIcon size={19} /> BẮT ĐẦU LƯỢT
              </button>
              <small>Nhấn SPACE để bắt đầu · {activePlayer.language === "vi-VN" ? "Tiếng Việt" : "English"}</small>
            </section>
          )}

          {phase === "countdown" && (
            <section className="stage-panel countdown-panel">
              <span className="eyebrow">CHUẨN BỊ, {activePlayer.name.toUpperCase()}</span>
              <div className="countdown-number" key={seconds}>{seconds}</div>
              <p>Đưa microphone lại gần và chuẩn bị “nịnh”!</p>
            </section>
          )}

          {phase === "speaking" && (
            <section className="stage-panel speaking-panel">
              <div className="speaking-top">
                <span className="live-title"><i /> ĐANG GHI ÂM</span>
                <strong className={seconds <= 5 ? "urgent" : ""}>00:{String(seconds).padStart(2, "0")}</strong>
              </div>
              <div className="timer-track"><i style={{ width: `${progress}%` }} /></div>
              <div className="live-transcript" aria-live="polite">
                {speechTranscript || <span>Hãy bắt đầu lời khen của bạn…</span>}
              </div>
              {speechError && <p className="inline-warning">{speechError}</p>}
              <button className="stop-button" type="button" onClick={finishSpeaking}>KẾT THÚC SỚM</button>
            </section>
          )}

          {phase === "review" && (
            <section className="stage-panel review-panel">
              <span className="eyebrow">KIỂM TRA TRANSCRIPT</span>
              <h1>AI nghe được thế này</h1>
              <p>Sửa nhanh nếu hội trường quá ồn hoặc tên riêng bị nhận sai.</p>
              <textarea
                autoFocus
                value={draftTranscript}
                onChange={(event) => setDraftTranscript(event.target.value.slice(0, 1_200))}
                placeholder="Nhập lời khen tại đây nếu microphone không nhận được…"
                rows={5}
              />
              <div className="review-footer">
                <span>{draftTranscript.length}/1200 ký tự</span>
                <div>
                  <button className="ghost-button" type="button" onClick={startTurn}>THỬ LẠI</button>
                  <button className="primary-button compact" type="button" onClick={confirmTranscript}>
                    XÁC NHẬN <ArrowIcon size={18} />
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
                  <span className="eyebrow">AI JUDGE ĐANG SUY NGHĨ</span>
                  <h1>Đang đo độ “nịnh”…</h1>
                  <p>Phân tích sáng tạo · hoa mỹ · đúng chủ đề · độ nịnh</p>
                </>
              ) : (
                <>
                  <span className="error-symbol">!</span>
                  <span className="eyebrow">AI JUDGE MẤT BÌNH TĨNH</span>
                  <h1>Chưa lấy được điểm</h1><p>{judgeError}</p>
                  <div className="error-actions">
                    <button className="ghost-button" type="button" onClick={() => void judgeRound(players)}>THỬ LẠI</button>
                    <button className="primary-button compact" type="button" onClick={useLocalFallback}>DÙNG BACKUP JUDGE</button>
                  </div>
                </>
              )}
            </section>
          )}

          {phase === "round-result" && roundResult && (
            <section className="result-panel">
              <div className="result-heading">
                <div><span className="eyebrow">ROUND {round} RESULT</span><h1>AI đã phán quyết</h1></div>
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
                      {won && <span className="winner-ribbon"><TrophyIcon size={14} /> THẮNG ROUND</span>}
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
                {round < 2 ? "SANG ROUND 2" : "XEM QUÁN QUÂN"} <ArrowIcon size={19} />
              </button>
            </section>
          )}
        </>
      )}
    </main>
  );
}
