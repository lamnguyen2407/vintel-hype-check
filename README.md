# Hype Check

A two-player, three-round AI challenge for the Vintelligence Club Fair. Players answer two easy open questions about AI and machine learning, then finish with a shameless Vintelligence hype round.

## Game format

- Round 1: easy AI knowledge question.
- Round 2: easy machine-learning explanation question.
- Round 3: funny, original, and shameless Vintelligence flattery.
- Each player gets 15 seconds per round.
- Each round uses a different 100-point rubric.
- The final scoreboard separates Round 1, Round 2, Round 3, and the 300-point total.

## Speech pipeline

The browser uses two transcription layers:

1. Chrome Speech Recognition supplies immediate live subtitles.
2. `MediaRecorder` captures a noise-suppressed mono recording.
3. `/api/transcribe` sends the final recording to `gpt-4o-transcribe`.
4. A vocabulary prompt and local normalizer preserve names such as Vintelligence, Vintel, VinUniversity, and VinUni.
5. The player can verify or edit the transcript before judging.

Browser microphone constraints enable echo cancellation, noise suppression, automatic gain control, and a single audio channel. A close external microphone is still recommended for a loud club-fair venue.

## AI judging

The server evaluates both players in the same request to reduce ordering bias. It uses strict performance bands, question-specific rubrics, independent scoring, prompt-injection boundaries, and hard maximums for every criterion. A deterministic local backup judge keeps the game playable if the API is unavailable.

## Run locally

Requires Node.js 20.9 or newer.

```powershell
cd C:\Users\ADMIN\khen-clb-ai
npm install

if (!(Test-Path .env.local)) {
    Copy-Item .env.example .env.local
}

npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in Google Chrome.

Configure `.env.local` for advanced transcription and AI judging:

```env
OPENAI_API_KEY=sk-your-api-key
OPENAI_MODEL=gpt-6-astra
OPENAI_TRANSCRIBE_MODEL=gpt-4o-transcribe
```

Without an API key, live browser subtitles and the backup judge still work.

## Controls

- Press `Space` on the ready screen to start a turn.
- Press `Space` while speaking to finish early.
- Vietnamese is the default speech language; English can be selected per player.
- Questions and interface copy remain in English.
- Use Fullscreen mode at the booth.

## Verification

```bash
npm run lint
npm run typecheck
npm run build
npm run start
```

Test once with the exact laptop, browser, microphone, speakers, and background music that will be used at the event.
