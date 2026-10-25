# Optimize

**One button that rewrites your prompt into the shape the frontier model actually wants, using the labs' own latest published guidance. Refreshed daily. Never sends anything. You read it, then you press Enter.**

Tyler Mishoulam calls this his golden nugget. It started as a per-pane button in his [Herdr](https://github.com/herdrdev/herdr) fork and is published here generalized to **any large-language-model harness**: Claude Code, Codex, a chat box in a browser, a terminal, your own app.

## Two ways to use it

1. **Build it in.** Call `optimize/optimize.py` from your harness (a button, a slash command, a pre-send hook). It reads a draft on stdin and returns a labelled packet, or JSON with `--json`.
2. **Highlight and click.** Run `optimize/optimize-selection.sh` from a hotkey or launcher. Highlight a draft in *any* app, press the key, and the highlighted text is replaced in place by the optimized packet. The cursor sits at the end. Nothing is sent until you press Enter.

```bash
# requirements: python3 (standard library only) and any OpenAI-compatible model endpoint
git clone https://github.com/tbmsindemnify/optimize-button ~/optimize-button

# 1) pipe a draft
echo "fix the login bug, don't touch the database" | ~/optimize-button/optimize/optimize.py --provider claude

# 2) hotkey on Hyprland / Omarchy (hyprland.lua or hyprland.conf)
bind = SUPER, O, exec, ~/optimize-button/optimize/optimize-selection.sh
```

Default model endpoint is a local Ollama (`http://127.0.0.1:11434/v1`, model `qwen3-14b-local:latest`). Point it anywhere OpenAI-compatible: llama.cpp, exo, LM Studio, or a cloud model.

```bash
export OPTIMIZE_ENDPOINT=http://127.0.0.1:11434/v1
export OPTIMIZE_MODEL=qwen3.6:27b
export OPTIMIZE_PROVIDER=claude        # claude | codex | generic
# cloud example: OPTIMIZE_ENDPOINT=https://api.openai.com/v1 OPTIMIZE_MODEL=gpt-5-mini OPTIMIZE_API_KEY=...
```

## What one click changes

Every line below is on paper from Anthropic and OpenAI themselves (sources in `guidance/provider-guidance.md`):

| Line | What it does | Why it works |
|---|---|---|
| **GOAL** | states the request as an outcome | models perform best when told what finished looks like |
| **DONE WHEN** | an observable check | the model knows when to stop; you know when to trust it |
| **EFFORT** | light / normal / deep thinking | thinking tokens are billed as output; match effort to the job |
| **AUTONOMY** | read-only / propose / apply | a read-only draft never gains write permission in the rewrite |
| **SHAPE** | checklist, table, diff, one line, file | the answer is the expensive part; shape it before you ask |
| **TOOLS/SKILLS** | attach only what the job needs, drop the rest | every tool definition left plugged in is tokens on every turn |
| **CONTEXT** | the exact file, page, record to look at | pointing beats "you know my project" |
| **COMPACT** | compact a long thread first | long contexts go stale and cost more per turn |
| **PROMPT** | the rewritten request, constraints kept word for word | nothing you said gets lost in translation |

Why a model does the translating: your vocabulary for what you want is a sentence; the model's vocabulary for what it can do is the whole library. The rules do the heavy lifting, so the rewrite model can be small and local (Tyler's runs on a Mac mini in about eleven seconds).

## It keeps itself current

- `guidance/sources.json` lists the official pages: Anthropic/Claude Code guidance, OpenAI/Codex guidance, web search and scraping tools (Firecrawl, Exa, Tavily, Crawl4AI), video generation tools (Veo, Kling, Seedance, Wan, Runway, LTX).
- `scripts/refresh_guidance.py` runs **every day** in GitHub Actions: it fetches each page, diffs it against the last snapshot, saves a dated text snapshot under `guidance/snapshots/`, and appends what changed to `guidance/CHANGELOG.md`. No API key, no model, fully deterministic.
- Changes become rules through a **reviewed pull request**: a human (or an agent run that opens a PR) reads the diff and edits `guidance/provider-guidance.md` and `catalog/*.md`. The merge is the approval. The button reads those files on every click, so a merged rule is live immediately.

So the latest tool, the new skill everyone is talking about, the lab's new prompting advice: it lands in the rules, and the button applies it before your prompt ever enters the model.

## What's in the box

```
optimize/optimize.py              harness-agnostic optimizer (stdlib only; stdin/argument -> packet or JSON)
optimize/optimize-selection.sh    highlight-and-click wrapper (Wayland wl-paste/wtype, X11 xclip/xdotool, macOS pbpaste/osascript)
guidance/provider-guidance.md     the rules, with sources and the date of the last human review
guidance/sources.json             the official pages the daily job watches
guidance/CHANGELOG.md             what changed on those pages, by day (written by the job)
guidance/snapshots/<date>/        text snapshots of changed pages
catalog/prompt-vocabulary.md      the words a model needs to hear (outcome first)
catalog/web-scraping.md           Firecrawl, Exa, Tavily, Crawl4AI, Jina, Playwright, Perplexity: what each does, which pairs
catalog/video-generation.md       Veo, Kling, Seedance, Wan, Runway, HeyGen, LTX, Remotion (Sora shut down Sept 24, 2026)
integrations/claude-code.md       how the packet maps onto Claude Code (effort, skills, /compact <focus>)
integrations/codex.md             how the packet maps onto Codex (reasoning effort, skills, /compact)
integrations/herdr/               the original Herdr per-pane implementation, as reference
scripts/refresh_guidance.py       the daily fetch/diff/snapshot/changelog job
.github/workflows/                the daily schedule
```

## Honest limits

- The button rewrites text. It does not install or delete software, and it does not send anything. "What to install and what to delete" shows up as advice in the catalogs and the PROMPT line; you act on it.
- The daily job records that a page changed and what changed. Turning that into a rule is a reviewed edit, not an automatic rewrite, on purpose.
- Rules and catalogs are dated. Vendor pages win over this repo when they disagree.
- Search tools: a query leaves your machine. Exa's self-serve plans may use queries for training (see `catalog/web-scraping.md`). Never put client data or internal strategy in a query.
- Quality of the rewrite depends on the model you point it at. A 4B–14B local model with these rules is the design point; bigger is better, not required.

## Where it came from

Tyler Mishoulam is a licensed Texas public adjuster who runs his firm on his own hardware and builds his own tools. Herdr is the terminal workspace he uses; the Optimize button lives in his fork and is published here so anybody can have it. Videos: MISH Networking on YouTube.

MIT License.
