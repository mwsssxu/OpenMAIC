# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
pnpm dev              # Start dev server on port 3030 (Next.js 16 + Turbopack)
pnpm build            # Production build
pnpm start            # Start production server

# Testing
pnpm test             # Run Vitest unit tests (tests/**/*.test.ts)
pnpm test:e2e         # Run Playwright e2e tests
pnpm test:e2e:ui      # Playwright UI mode

# Linting
pnpm lint             # ESLint
pnpm check            # Prettier check
pnpm format           # Prettier write

# Dependencies
pnpm install          # Install deps (includes workspace packages: mathml2omml, pptxgenjs)
```

## Configuration

- `.env.local` — Local environment config (copy from `.env.example`)
- `server-providers.yml` — Server-side provider config (LLM/TTS/ASR/Image/Video)
- At least one LLM API key required: OpenAI, Anthropic, Google, DeepSeek, MiniMax, Grok, Ollama, etc.

## Architecture Overview

### Two-Stage Generation Pipeline (`lib/generation/`)

1. **Outline Generation** — User requirements + documents → structured scene outlines
2. **Scene Generation** — Each outline → full scene with actions (slides/quiz/interactive/pbl)

Key files:
- `generation-pipeline.ts` — Pipeline coordinator
- `outline-generator.ts` — Stage 1: outline generation
- `scene-generator.ts` — Stage 2: scene content generation
- `scene-builder.ts` — Build final Scene objects
- `action-parser.ts` — Parse agent actions from LLM output

### Multi-Agent Orchestration (`lib/orchestration/`)

LangGraph state machine managing agent turns and discussions.

- `director-graph.ts` — LangGraph graph definition (director → agents)
- `stateless-generate.ts` — Stateless generation for streaming responses
- `prompt-builder.ts` — Build agent prompts with context

### Playback Engine (`lib/playback/`)

State machine driving classroom playback and live interaction.

States: `idle → playing → paused → live → paused`

- `engine.ts` — Main playback engine class
- Consumes `Scene.actions[]` directly via ActionEngine

### Action Engine (`lib/action/`)

Unified execution layer for 28+ action types (speech, whiteboard, spotlight, laser, etc.).

Two modes:
- Fire-and-forget: spotlight, laser — dispatch and return
- Synchronous: speech, whiteboard, discussion — await completion

### Key Type Definitions (`lib/types/`)

- `generation.ts` — Generation pipeline types (SceneOutline, UserRequirements, etc.)
- `action.ts` — Action types (SpeechAction, WbDrawTextAction, etc.)
- `stage.ts` — Scene types (slide, quiz, interactive, pbl)

### Canvas-Based Slide System (`components/slide-renderer/`)

- Editor with interactive canvas
- Element renderers: text, image, shape, table, chart, latex

### API Routes (`app/api/`)

- `generate/` — Scene generation endpoints (outlines, content, images, TTS)
- `generate-classroom/` — Async classroom job submission + polling
- `chat/` — Multi-agent discussion (SSE streaming)
- `pbl/` — Project-Based Learning endpoints

## Workspace Packages

- `packages/mathml2omml` — MathML → Office Math conversion
- `packages/pptxgenjs` — Customized PowerPoint generation

Both are built during `pnpm install` (postinstall script).

## Scene Types

| Type | Description |
|------|-------------|
| `slide` | Canvas-based slides with agent narration |
| `quiz` | Interactive quizzes (single/multiple choice, short answer) |
| `interactive` | HTML-based interactive simulations |
| `pbl` | Project-Based Learning with milestones |

## Agent Actions

Actions are parsed from LLM output and executed by ActionEngine:

- `speech` — Voice narration (TTS or browser-native)
- `whiteboard` — Draw text/shape/chart/latex/table/line
- `spotlight` / `laser` — Visual effects on slide
- `discussion` — Trigger classroom discussion
- `playVideo` — Play embedded video

## Testing

- Unit tests in `tests/**/*.test.ts` (Vitest)
- Eval tests in `tests/**/*.eval.test.ts` (separate vitest.eval.config.ts)
- E2E tests in `e2e/tests/*.spec.ts` (Playwright)

## OpenClaw Integration

Skill in `skills/openmaic/` enables generating classrooms from chat apps (Feishu, Slack, Telegram, etc.).

Modes:
- Hosted — Access code from open.maic.chat
- Self-hosted — Local deployment guided by skill