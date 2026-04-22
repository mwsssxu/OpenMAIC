# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## OpenMAIC Business Releases

### [v0.23.1] - 2026-04-22 — Mobile & Persona Fixes ✅

**Bug fixes and improvements for mobile app and AI Personas.**

#### Mobile (feat/mobile branch)
- Fixed persona chat API routing (`/personas/chat` endpoint)
- Fixed agent ID mapping between frontend and backend (confucius/socrates/da_vinci)
- Added PersonaChatResponse missing fields (elapsed_seconds, fallback)
- Improved slide display UI with card layout and styled elements
- Removed debug console.log statements from production code

#### Backend Security & Reliability
- Security: User content logging changed to DEBUG level with truncation (100 chars)
- Added database transaction wrapper for classroom creation (data consistency)
- Enhanced LLM logging with prompt/response details for debugging

---

### [v0.23.0] - 2026-04-17 — Production Ready ✅

**Final release with all phases complete.**

- **API Endpoints:** 231
- **Database Tables:** 62
- **Frontend Pages:** 67

#### Commercial Loop (P1)
- Learning assessment with mastery levels (精通/熟练/掌握/了解/需复习)
- Course completion with recommendations
- Note citations linking to course content
- Note reminders after completion

#### Enterprise (P4)
- Enterprise account management
- Team invitations with roles (owner/admin/member/viewer)
- Course assignments and learning reports
- Admin dashboard (16 pages)

#### AI Extensions (P2)
- Video-to-course (YouTube/Bilibili)
- AI Personas (孔子/苏格拉底/达芬奇)
- Programming templates with auto-grading
- Learning depth levels (skim/understand/master)

#### Performance (Phase 6)
- Redis caching for hot data
- Docker multi-stage builds
- Deployment documentation (K8s)

---

### [v0.22.0] - 2026-04-17

- Enterprise routes (12 endpoints)
- Enterprise database schema (6 tables)

### [v0.21.0] - 2026-04-17

- Note citations routes (5 endpoints)
- Citation tracking on scenes

### [v0.20.0] - 2026-04-17

- Course completion tracking
- Course recommendations

### [v0.19.0] - 2026-04-16

- AI personas sessions
- Learning passport
- Interval review (Ebbinghaus)

### [v0.18.0] - 2026-04-16

- Video course generation
- Programming templates
- Learning depth config

### [v0.17.0] - 2026-04-16

- Share card generation
- Note reminder templates

### [v0.16.0] - 2026-04-16

- League system (7 levels)
- Achievement expansion

### [v0.15.0] - 2026-04-16

- Daily check-in (incremental rewards)
- Daily tasks (6 types)

### [v0.14.0] - 2026-04-15

- Learning buddy (6 AI types)
- Shared notes marketplace (70/30 split)
- Learning matching

### [v0.13.0] - 2026-04-15

- Token purchase packages
- Point rewards
- Subscription tiers

### [v0.12.0] - 2026-04-15

- Question bounty
- Invite rewards

### [v0.11.0] - 2026-04-15

- Point accounts/transactions
- Token balance

### [v0.10.0] - 2026-04-14

- Admin JWT auth
- RBAC permissions
- Content moderation

### [v0.9.0] - 2026-04-14

- Learning assessment routes

### [v0.8.0] - 2026-04-14 — Enhanced Experience

- Whiteboard improvements
- TTS voice options
- Slide export formats

### [v0.7.0] - 2026-04-13

- Multi-agent classroom
- Scene management

### [v0.6.0] - 2026-04-13

- OSS media upload
- Media routes

### [v0.5.0] - 2026-04-12

- WebSocket classroom
- Real-time collaboration

### [v0.4.0] - 2026-04-12 — Core Refactor

- Async SQLAlchemy with asyncpg
- UUID primary keys
- JWT authentication
- Alembic migrations

---

## Original OpenMAIC Releases

## [0.1.0] - 2026-03-26

The first tagged release of OpenMAIC, including all improvements since the initial open-source launch.

### Highlights

- **Discussion TTS** — Voice playback during discussion phase with per-agent voice assignment, supporting all TTS providers including browser-native [#211](https://github.com/THU-MAIC/OpenMAIC/pull/211)
- **Immersive Mode** — Full-screen view with speech bubbles, auto-hide controls, and keyboard navigation [#195](https://github.com/THU-MAIC/OpenMAIC/pull/195) (by @YizukiAme)
- **Discussion buffer-level pause** — Freeze text reveal without aborting the AI stream [#129](https://github.com/THU-MAIC/OpenMAIC/pull/129) (by @YizukiAme)
- **Keyboard shortcuts** — Comprehensive roundtable controls: T/V/Esc/Space/M/S/C [#256](https://github.com/THU-MAIC/OpenMAIC/pull/256) (by @YizukiAme)
- **Whiteboard enhancements** — Pan, zoom, auto-fit [#31](https://github.com/THU-MAIC/OpenMAIC/pull/31), history and auto-save [#40](https://github.com/THU-MAIC/OpenMAIC/pull/40) (by @YizukiAme)
- **New providers** — ElevenLabs TTS [#134](https://github.com/THU-MAIC/OpenMAIC/pull/134) (by @nkmohit), Grok/xAI for LLM, image, and video [#113](https://github.com/THU-MAIC/OpenMAIC/pull/113) (by @KanameMadoka520)
- **Server-side generation** — Media and TTS generation on the server [#75](https://github.com/THU-MAIC/OpenMAIC/pull/75) (by @cosarah)
- **1.25x playback speed** [#131](https://github.com/THU-MAIC/OpenMAIC/pull/131) (by @YizukiAme)
- **OpenClaw integration** — Generate classrooms from Feishu, Slack, Telegram, and 20+ messaging apps [#4](https://github.com/THU-MAIC/OpenMAIC/pull/4) (by @cosarah)
- **Vercel one-click deploy** [#2](https://github.com/THU-MAIC/OpenMAIC/pull/2) (by @cosarah)

### Security

- Fix SSRF and credential forwarding via client-supplied baseUrl [#30](https://github.com/THU-MAIC/OpenMAIC/pull/30) (by @Wing900)
- Use resolved API key in chat route instead of client-sent key [#221](https://github.com/THU-MAIC/OpenMAIC/pull/221)

### Testing

- Add Vitest unit testing infrastructure [#144](https://github.com/THU-MAIC/OpenMAIC/pull/144)
- Add Playwright e2e testing framework [#229](https://github.com/THU-MAIC/OpenMAIC/pull/229)

### New Contributors

@YizukiAme, @nkmohit, @KanameMadoka520, @Wing900, @Bortlesboat, @JokerQianwei, @humingfeng, @tsinglua, @mehulmpt, @ShaojieLiu, @Rowtion
