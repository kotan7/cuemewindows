Hybrid: Reservation + Async Ingestion with Local Queue

Goal: minimize latency for users, avoid overcounting, remain secure, and keep storage/accounting accurate.

Overview (high-level flow)

Client (Electron)

Keep a local quota cache (fetched at login).

Maintain a local persistent event queue (SQLite or on-disk JSON) of usage events with event_id (UUID), tokens, timestamp, reservation_id (optional), status.

For most calls, call Gemini directly (no blocking network roundtrip to your server) to avoid latency — if local cache shows plenty of quota.

After a successful Gemini response, enqueue a usage event and fire-and-forget POST it to /functions/ingest-usage (keepalive or background flush). If network offline, keep it until next flush.

If local cache is low (near quota) or your policy requires strict enforcement: call /functions/reserve-usage before Gemini to reserve 1 (or N) units, then call Gemini. After success confirm with ingest (includes reservation id). On failure call /functions/cancel-reservation.

Server / Supabase Edge Functions

/functions/reserve-usage — fast, atomic. Validates JWT and runs a single DB transaction to increment reserved (or create row) and return a reservation_id and remaining quota. If quota exceeded, deny. Reservations expire automatically (eg. 5 min).

/functions/ingest-usage — accepts one or a batch of events {event_id, user_id, tokens, ts, reservation_id?}. Runs as an idempotent ingestion:

INSERT INTO gemini_events ON CONFLICT DO NOTHING (so duplicate events from retries won't double-count).

If record is newly inserted, atomically update usage_tracking (decrement reserved if reservation_id present, increment used) inside a transaction.

Return results per event (accepted/duplicate/over-limit).

/functions/cancel-reservation — cancels a reservation (if Gemini failed).

cleanup cron — release expired reservations (decrease reserved) to avoid stuck reservations.

Supabase DB

usage_tracking — one row per (user_id, month_year) with columns: used, reserved.

usage_reservations — id, user_id, month_year, amount, expires_at, status.

gemini_events — event_id (PK), user_id, month_year, tokens, created_at, reservation_id nullable.

Postgres constraints + stored procedures enforce atomicity and enforce quotas on ingest/reserve.

Why this is better

Low-latency UX: most flows call Gemini directly (no pre-check) — client only posts a small event afterward.

Safety: reservation path prevents going past quota when strict enforcement is required.

Idempotency: event_id + ON CONFLICT DO NOTHING prevents double-counting.

Resilience: offline/ flaky network supported by local persistent queue + background flush.

Atomic accounting: DB-side transaction checks ensure quotas are never violated (reservation + ingest logic).

Scalable ingestion: ingestion endpoint accepts batches to amortize DB costs.

Tradeoffs & policy choices

If you must strictly prevent any over-usage (no policy where user can exceed then be billed), use reservation-before-call always. That incurs a small extra roundtrip cost/latency but guarantees enforcement.

If you accept small, rare overages (and reconcile billing later), prefer the call-then-log flow (faster UX).

You can combine: default to call-then-log; if local cache low → reserve-first.