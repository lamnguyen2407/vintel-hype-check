# Hype Check

A two-player, AI-scored pitch battle built for Vintelligence Club Fair. Each player gets 15 seconds to sell the room on Vintelligence and VinUniversity. Their speech is transcribed live and scored across four categories.

## Features

- Two players, two rounds, and automatic match totals.
- Three-second countdown and 15-second speaking timer.
- Live English or Vietnamese speech-to-text through the Web Speech API.
- Editable transcripts before judging.
- OpenAI Structured Outputs with Zod; the API key stays server-side.
- Both players are scored in the same request to reduce ordering bias.
- Four scoring categories: creativity 30, delivery 25, specificity 25, and hype 20.
- Deterministic backup judge when an API key is unavailable.
- Fullscreen responsive interface designed for a club fair display.
- Prompt-injection resistance through a strict system prompt and transcript boundaries.

## Run locally

Requires Node.js 20.9 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in Google Chrome.

To enable the OpenAI judge, configure `.env.local`:

```env
OPENAI_API_KEY=sk-your-api-key
OPENAI_MODEL=gpt-6-astra
```

Leave `OPENAI_API_KEY` empty to play the complete game with the backup judge.

## Keyboard controls

- Press `Space` on the ready screen to start a turn.
- Press `Space` while speaking to finish early.
- Select English or Vietnamese speech recognition for each player.
- Edit or manually enter a transcript when the venue is too noisy.

## Pre-event verification

```bash
npm run lint
npm run typecheck
npm run build
npm run start
```

Test with the same laptop and microphone that will be used at the booth. Grant Chrome microphone permission before the event and keep a separate hotspot ready.

## Architecture

```text
Browser microphone
  → Web Speech API
  → editable transcript
  → POST /api/judge
  → OpenAI structured score or backup judge
  → round score → final winner
```

`src/app/api/judge/route.ts` keeps the API key on the server. The frontend never receives or stores the secret.
