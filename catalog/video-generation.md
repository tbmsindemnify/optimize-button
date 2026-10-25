# Video generation tools (what the Optimize button knows about)

Checked 2026-10-24 against vendor pages and current roundups (llms.blog "Best AI Video Generators, October 2026"; versely.studio; dbggr.dev). The refresh job watches the vendor pages in `guidance/sources.json`; this file is updated by a reviewed pull request when they change. Prices and limits move monthly; the vendor page wins over this file.

Status note: OpenAI shut down Sora 2 and the Videos API on September 24, 2026 (OpenAI video guide and deprecations page). Do not route video work to Sora.

| Tool | Maker | Good for (per vendor/roundups) | Access | Open weights |
|---|---|---|---|---|
| Veo 3.1 / Gemini Omni Flash | Google | dialogue, native audio, conversational editing; widest access (Gemini app, API, YouTube Shorts) | API + app | no |
| Kling 4.0 (Oct 15, 2026) / Kling 3.0 | Kuaishou | photoreal people; 4.0 adds long takes | app + API | no |
| Seedance 2.5 | ByteDance Seed | 30-second single takes | API / partner apps | no |
| Wan 3.0 | Alibaba | long single-pass clips; strong text adherence; API ~$0.05–0.20 per second (480p–1080p) | API; earlier Wan versions have open weights on GitHub/Hugging Face | partial |
| Runway (Gen-4.5 line) | Runway | motion quality, prompt adherence, editing suite | app + API | no |
| HeyGen | HeyGen | talking-head / avatar video for business explainers | app | no |
| LTX-Video (LTX-2) | Lightricks | runs locally on a single consumer GPU; fast drafts | open weights | yes |
| Remotion | Remotion | programmatic video from code (React); deterministic, repeatable, great with an AI coding agent | library | n/a |

How the button uses this: when a draft asks for video, the PROMPT line names the shot, duration, aspect ratio, audio need and whether a person's likeness is involved, and the TOOLS/SKILLS line proposes the tool that fits the shot (dialogue → Veo; people → Kling; long take → Seedance/Wan; local/offline → LTX; data-driven explainer → Remotion). It never generates a real person's likeness without their consent in the draft.
