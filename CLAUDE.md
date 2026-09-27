# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Repetitor** — CRM for private tutors: groups, daily attendance, monthly payments/charges, expenses, reports. One FastAPI backend serves three clients: `web/` (React, desktop-first, the primary client), `mobile/` (Flutter), and a super-admin platform view. Three roles share one `users` table: `teacher` (owns groups/students/payments), `student` (read-only: own attendance + payment history via `/students/me/*`), `super_admin` (platform stats only, no financial visibility into teachers' data by design).

Everything is in Uzbek (code comments, commit messages, UI strings, docstrings) — match that when editing.

## Commands

### Backend (`api/`)
```bash
python -m pip install -r requirements-dev.txt   # installs requirements.txt too
cp .env.example .env                            # then set SECRET_KEY; SQLite works out of the box
python -m alembic upgrade head                  # create/update schema
uvicorn app.main:app --reload --port 8000
pytest -q                                        # full suite
pytest tests/test_payments.py -q                 # single file
pytest tests/test_payments.py::test_partial_then_full_payment -q  # single test
ruff check app tests && ruff format --check app tests
python -m alembic revision --autogenerate -m "..."   # new migration after model changes — always review the generated file
```
Tests run on in-memory SQLite (`tests/conftest.py`), no Docker/Postgres needed. Local dev also defaults to SQLite via `DATABASE_URL_OVERRIDE` in `.env.example`.

### Frontend (`web/`)
```bash
npm install
npm run dev      # Vite dev server :5174, proxies /api to backend :8000 — no CORS in dev
npm run build    # tsc -b && vite build -> web/dist
npx oxlint
```

### Mobile (`mobile/`)
```bash
flutter run -d chrome --web-port=5173 --dart-define=API_BASE_URL=http://localhost:8000
flutter test
flutter analyze
```

## Architecture

### Backend: modular monolith
`api/app/modules/<name>/{models,schemas,service,router}.py` — one module per domain (`users`, `groups`, `attendance`, `payments`, `expenses`, `reports`, `admin`, `auth`). Routers only handle HTTP; all business logic lives in `service.py`, which makes it directly testable. `app/api/deps.py` centralizes auth dependencies: `CurrentTeacher` / `CurrentStudent` / `CurrentAdmin` (role-gated) and `VerifiedUser` (blocks endpoints until a forced password change is done).

**Everything is teacher-scoped.** Every service function that touches a teacher's data takes `teacher_id` and filters by it (`get_owned_student`, `Group.teacher_id == ...`, etc). A foreign teacher's resource returns 404, not 403 — existence itself is not revealed. When adding a new teacher-facing endpoint, follow this pattern; it's the app's core security invariant, not a per-endpoint decision.

**One `users` table for all three roles** (`app/modules/users/models.py`), disambiguated by `role`. Students get a `teacher_id` FK to their owning teacher; if that teacher is blocked, the student is locked out too (`effective_status`).

**Money model is two tables on purpose**: `MonthlyCharge` (what's owed, frozen at creation so later fee changes don't rewrite past months) and `Payment` (immutable ledger — reversals are new negative-amount rows, never edits/deletes).

**Password reset for students is request-gated**: a student who can't log in calls `POST /auth/password/request-reset-from-teacher` (no email/SMS code — this app doesn't have real delivery configured by default), which just sets `password_reset_requested_at`. The teacher's reset-password endpoint (`groups/service.py::reset_student_password`) refuses with 409 unless that flag is set. Don't let a teacher reset a student's password unconditionally — that's an explicit product requirement, not an oversight.

**Notifications** (`app/core/notify.py`): `email_sender`/`sms_sender` are swappable `MessageSender` instances — `ConsoleSender` (logs only) unless SMTP/Eskiz.uz credentials are set in `.env`, in which case `SmtpEmailSender`/`EskizSmsSender` are used automatically. Same pattern for anything needing pluggable I/O.

**PDF export** (`app/core/pdf.py`, reportlab): receipts and monthly reports as real downloadable files. Reportlab's default font only supports WinAnsi/cp1252 — avoid characters like "№" (use "No") or text silently renders as a missing-glyph box.

**Quizzes** (`app/modules/quizzes/`): teachers assign tests to groups in `practice` mode (unlimited attempts, no notifications) or `exam` mode (deadline + max_attempts required, results ranked and sent to parents). Catalog tests (`Quiz.is_catalog=True`) are authored by Super Admin only; a teacher must subscribe (`QuizSubscription`) before assigning one — same "Steam workshop" pattern for future add-ons like AI grading. Essay-type questions need manual grading (`grade_attempt`); an exam's ranking/notifications only fire once every attempt is fully graded and the deadline has passed (`maybe_finalize_assignment`, polled every 60s by `quizzes/scheduler.py` and also triggerable on demand via `POST /quizzes/assignments/{id}/finalize`). Parent notifications go through a long-polling Telegram bot (`quizzes/telegram_bot.py`, `/start <code>` links a parent's chat to a student) — both the bot and the scheduler are started from `main.py`'s `lifespan`, the only background tasks in the app.

### Deploy: backend serves the frontend
`app/main.py` mounts `web/dist/assets` and falls back to `index.html` for any unmatched path (SPA routing), if `web/dist` exists — configurable via `WEB_DIST_DIR`. This makes single-process deployment the default (no nginx/CORS needed); the fallback route **must stay registered last** so it doesn't shadow `/api/v1/*` or `/media`. If `web/dist` is missing, this is silently skipped and the API works standalone. There's also `api/desktop.py` (pywebview) for running the whole thing as a local desktop app — personal/temporary use only, not part of the deploy story.

### Frontend structure (`web/src/`)
- `features/<name>/` — one folder per screen/flow, colocated with its modals.
- `lib/api/{client.ts,queries.ts,types.ts}` — fetch wrapper (token refresh, `ApiError`), all TanStack Query keys/options in one file, response types in snake_case matching the API.
- `lib/i18n/` — dictionaries (`uz.ts` is the source of truth type; `ru.ts` must satisfy it structurally), lazy-loaded per locale so unused languages aren't shipped. Adding a language = one new dictionary file + one registry line.
- `lib/theme/` — same lazy-loaded-module pattern as i18n. Themes override the `--color-*` CSS custom properties Tailwind v4 generates, applied via `document.documentElement.style.setProperty` — so a new theme is one new token file, no component changes. When designing a theme, keep enough lightness separation between the `white` (card) and `slate-200` (border) tokens (8%+) or borders/cards visually disappear.
- Role-based routing: `RoleHome`/`AppShell` in `routes/router.tsx` and `components/layout/app-shell.tsx` branch nav and the landing route by `user.role` (`teacher`/`student`/`super_admin`) — student gets a deliberately reduced nav (own attendance/payments only).

### Testing conventions
Backend tests build fixtures through the real HTTP API (`tests/conftest.py`: `approved_teacher`, `create_group`, `add_student`), not by inserting rows directly — keeps tests honest about what the API actually allows. Isolation between teachers is tested explicitly (`test_isolation.py`) and should be extended whenever a new teacher-scoped endpoint is added.
