# RCJ Exam Hub · Free Exam & Interview Prep (Multilingual)

> English · 日本語 · 中文 — a free civil-service and job-interview study center,
> built on Cloudflare Pages. Practice questions, voice recording & AI review,
> plus a multilingual PayPal deposit store.

**Live site:** https://exam.955827.xyz

RCJ Exam Hub turns publicly available exam material into efficient study tools.
It is a pure static site (no backend, no build step) hosted on Cloudflare Pages,
with the storefront and key flows available in **English, Japanese, and Chinese**.

## What's inside

- **Past papers** — national, provincial, and public-institution civil-service exams,
  linked to open question banks (no self-hosted PDF library).
- **Structured interview practice** — general structured-interview question bank;
  draw by question type or by target profession; record locally, replay, export,
  and build your own question sets.
- **Firefighter drills (`/xf`)** — structured-interview bank for firefighters
  (national team + government-contracted), with recording drills and random draws.
- **Auxiliary-police drills (`/fj`)** — written + interview drills for multiple
  cities (Shenzhen, Huizhou, …) with recording, transcription, and AI feedback.
- **Tutorials** — how to build sites with domestic AI tools, Cloudflare Pages,
  GitHub basics, and free LLM APIs.
- **Paid custom demo** — a showcase of RCJ deliverables.
- **Shop** — PayPal checkout with a deposit model (pay a deposit now, the rest on
  delivery), available in EN / 日本語 / 中文.

Monetization: free past papers drive traffic → paid tools convert
(offline packs / Anki / AI review).

## Highlights

- 🌐 Trilingual storefront & flows (English / 日本語 / 中文)
- 💳 PayPal hosted-redirect checkout (works behind the GFW; no frontend SDK)
- 💰 Deposit model — capture a small deposit, collect the balance on delivery
- 🎙️ Local voice recording with replay, export, and optional AI review
- 🆓 Free to start — no account required for most practice

## Tech stack

- Cloudflare Pages (static) + Cloudflare Functions + D1 (SQLite)
- PayPal sandbox / live via hosted redirect
- Vanilla JS `i18n` dictionary

## Deploy

Connect Cloudflare Pages to `main`, build setting **None**, output `/`.
`git push` publishes.

---

Part of the [RCJ ecosystem](https://955827.xyz). Repo consolidated:
`xf-firefighter-exam` (→ `/xf`) and `aux-police-exam` (→ `/fj`) were merged in
August 2026 and deleted; `rcj-exam-bank` now covers the whole exam ecosystem.
