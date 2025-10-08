Title: Always-on Listening – Updated Implementation Plan

**STATUS: COMPLETED**
**Archived Date:** 2025/10/8
**Original Implementation:** 2025/09/09

Objective
- Provide always-on mic listening that transcribes audio, detects/collects likely questions, batches refinements, and fetches answers on demand with optional RAG, while keeping costs controlled.

Scope & Current State (Audit)
- Renderer
  - Audio capture via Web Audio: `getUserMedia`, `AudioContext`, `AudioWorklet` with fallback to `ScriptProcessor`.
  - Smart chunking in `public/audio-worklet-processor.js` using amplitude-based silence detection (800ms) and a 10s hard cap.
  - Sends `Float32Array` chunks to main via `audio-stream-process-chunk` IPC.
  - UI: `QuestionSidePanel` to list detected/refined questions and trigger answering.
- Main
  - `AudioStreamProcessor`: accumulates samples, converts to PCM, writes temp WAV, transcribes with OpenAI Whisper (`whisper-1`, ja), pushes to `QuestionDetector`, buffers and batches, calls Gemini via `LLMHelper` for refinement, emits events to renderer.
  - `QuestionDetector`: simple JP/EN regex, validity filter, lightweight dedupe.
  - `LLMHelper`: Gemini-based chat/RAG and rephrase, plus image/audio helpers used elsewhere.
  - `QnAService`: Supabase + OpenAI embeddings for RAG.
  - `UsageTracker`: IPC guards for cost control.
- Events/IPC: `onAudioQuestionDetected`, `onAudioBatchProcessed`, `onAudioStreamStateChanged`, `onAudioStreamError`, plus start/stop/state/get/clear/answer methods.

Delta vs Original Draft
- VAD: Using amplitude threshold (renderer) instead of Silero/WebRTC VAD. Good enough for MVP, upgradeable later without API changes.
- ASR: Cloud Whisper instead of local whisper.cpp. Faster to ship; revisit later.
- Batching & Cost: Implemented interval-based batching and usage tracking at IPC level; aligns with plan.

Risks
- Dependence on network/Whisper latency and cost.
- Amplitude-only VAD may mis-split in noisy environments; acceptable for MVP.
- Temp file cleanup must remain reliable under errors.

Non-Goals (now)
- Local offline ASR.
- Full analytics/telemetry beyond minimal logs.

Milestones & Sessions (MVP-first)
1) Stream Lifecycle & State Stability ✅
   - Verify start/stop propagation and renderer header status (listening/processing).
   - Ensure errors propagate to `onAudioStreamError` and stop loop cleanly.
   - Acceptance: Toggle on/off without stuck states; UI reflects status.

2) Question Buffer UX & Dedup ✅
   - Ensure list shows newest first; dedupe near-duplicates across raw/refined entries.
   - Optional debounce to suppress identical detection bursts.
   - Acceptance: No spam from repeated phrasings; list remains compact.

3) Batch Refinement & Cost Caps ✅
   - Keep batch interval at 30s and cap size via config; skip when empty.
   - Confirm usage checks where answers/refinements incur LLM calls.
   - Acceptance: At most one refinement per interval; graceful error handling.

4) Answer-on-Click + RAG Path ✅
   - Wire `audio-stream-answer-question` with optional `collectionId` from UI mode.
   - Cache answers per question id within session to prevent duplicate spends.
   - Acceptance: Answer appears inline; repeated clicks don't re-spend unless forced.

5) Optional VAD Upgrade (post-MVP) - DEFERRED
   - Evaluate Silero (ONNX Runtime Web/Electron) or WebRTC VAD; measure CPU/accuracy.
   - Maintain renderer → main chunk API.
   - Acceptance: Comparable or better segmentation with low overhead.

6) Polish ✅
   - Subtle UI improvements: highlight new/refined, compact counters, lightweight loading.
   - Minimal diagnostic logs behind a flag.

Change Log
- 2025-09-09: Initial updated plan written based on current code audit.
- 2025-09-09: Session 1 implemented (cleanup effect in QueueCommands). Lint passed.
- 2025-09-09: Session 2 implemented (dedup rendering in QuestionSidePanel via memoized normalized text). Added optional refinedText read on UI only; types updated.
- 2025-09-09: Session 3 implemented (hybrid batching in AudioStreamProcessor: size/interval triggers, batch cap, single-flight).
- 2025-09-09: Session 4 implemented (answer memoization in Queue; panel updates inline answer on resolve). Lint passed.
- 2025-10-08: Task archived as DONE - feature is complete and working in production.

**COMPLETION NOTES:**
- All MVP milestones achieved
- Feature is stable and in production use
- VAD upgrade deferred to future enhancement
- No breaking changes or regressions
