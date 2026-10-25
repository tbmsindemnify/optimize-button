#!/usr/bin/env python3
"""Optimize: rewrite a draft prompt into the shape a frontier model actually wants.

Harness-agnostic. Standard library only. Works three ways:

  echo "fix the login bug" | optimize.py                 # stdin -> stdout
  optimize.py --draft "summarize this claim file"        # argument
  optimize-selection.sh                                  # highlighted text, any app (see the shell wrapper)

The rules it applies are the labs' own published guidance (guidance/provider-guidance.md),
plus the tool catalogs (catalog/*.md) and the prompt vocabulary (catalog/prompt-vocabulary.md).
Those files are refreshed by scripts/refresh_guidance.py (daily in CI) and reviewed by a human
before they change. The rewrite itself runs on any OpenAI-compatible endpoint: a local model
(Ollama, llama.cpp, exo, LM Studio) or a cloud one. Default is a local Ollama model.

The output is a short, labelled packet. It is never sent anywhere by this script. You read it,
then you press Enter. Approval is the click of a button.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GUIDANCE = ROOT / "guidance" / "provider-guidance.md"
CATALOG = ROOT / "catalog"

DEFAULT_ENDPOINT = os.environ.get("OPTIMIZE_ENDPOINT", "http://127.0.0.1:11434/v1")
DEFAULT_MODEL = os.environ.get("OPTIMIZE_MODEL", "qwen3-14b-local:latest")
API_KEY = os.environ.get("OPTIMIZE_API_KEY", "")
TIMEOUT = float(os.environ.get("OPTIMIZE_TIMEOUT", "120"))

PROVIDERS = {
    "claude": {
        "name": "Claude Code / Claude apps",
        "compact": "/compact <focus>",
        "effort": "effort: low | medium | high (extended thinking only when the job needs it)",
        "skills": "skills load progressively: name the SKILL.md the job needs, nothing else",
    },
    "codex": {
        "name": "OpenAI Codex",
        "compact": "/compact",
        "effort": "reasoning effort: minimal | low | medium | high",
        "skills": "skills: name the installed skill(s) the job needs; prune overlapping instructions",
    },
    "generic": {
        "name": "any LLM harness",
        "compact": "start a fresh thread with a one-paragraph summary",
        "effort": "effort: light | normal | deep",
        "skills": "attach only the instructions/tools the job needs",
    },
}

CONSTRAINT_WORDS = re.compile(
    r"\b(must|never|only|don't|do not|without|no |keep|exactly|under \$?\d|before|after|by )\b", re.I
)


def read_text(path: Path, limit: int = 12000) -> str:
    try:
        return path.read_text(encoding="utf-8")[:limit]
    except OSError:
        return ""


def rules_bundle() -> str:
    parts = [read_text(GUIDANCE)]
    for name in ("prompt-vocabulary.md", "web-scraping.md", "video-generation.md"):
        t = read_text(CATALOG / name, 6000)
        if t:
            parts.append(f"\n\n# catalog/{name}\n{t}")
    return "\n".join(parts)


def constraints(draft: str) -> list[str]:
    out = []
    for sentence in re.split(r"(?<=[.!?])\s+|\n+", draft):
        s = sentence.strip()
        if s and CONSTRAINT_WORDS.search(s):
            out.append(s)
    return out[:8]


def system_prompt(provider: str) -> str:
    p = PROVIDERS[provider]
    return f"""You are the Optimize button. You rewrite ONE draft request into the shape that {p['name']} performs best with, following the provider guidance and catalogs below. You never answer the request yourself. You never invent tools, skills, files or facts that are not in the draft or the catalogs. Keep the user's meaning, scope and every constraint exactly.

Return plain text, these labelled lines only, each on its own line, no markdown, no preamble:
GOAL: one sentence, stated as the outcome the user wants
DONE WHEN: the observable check that says the job is finished
EFFORT: {p['effort']} ; one short reason
AUTONOMY: read-only | propose-then-apply | apply ; a read-only draft never gains write autonomy
SHAPE: the exact output form (checklist, table, diff, one line, file, ...)
TOOLS/SKILLS: {p['skills']} ; list only what the job needs, and what to drop
CONTEXT: the specific files, pages, names or data the model should look at; if the draft names none, say "ask: ..." with the one question that unblocks it
COMPACT: yes ({p['compact']}) only if the user says the thread is long or stale; otherwise no
PROMPT: the rewritten request itself, 1-6 sentences, outcome first, constraints kept word for word

Guidance and catalogs (dated; prefer the newest entries):
{rules_bundle()}
"""


def call_model(endpoint: str, model: str, system: str, user: str) -> str:
    url = endpoint.rstrip("/") + "/chat/completions"
    body = json.dumps({
        "model": model,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        "temperature": 0.1,
        "max_tokens": 900,
        "stream": False,
    }).encode()
    headers = {"Content-Type": "application/json"}
    if API_KEY:
        headers["Authorization"] = f"Bearer {API_KEY}"
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        data = json.loads(resp.read().decode())
    text = data["choices"][0]["message"]["content"]
    # strip hidden reasoning blocks some local models emit
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.S).strip()
    return text


def packet(draft: str, provider: str, endpoint: str, model: str) -> dict:
    kept = constraints(draft)
    user = f"DRAFT:\n{draft.strip()}\n\nCONSTRAINTS THE USER WROTE (quote back verbatim under PROMPT if relevant):\n" + "\n".join(f"- {c}" for c in kept)
    text = call_model(endpoint, model, system_prompt(provider), user)
    lines = {}
    for line in text.splitlines():
        m = re.match(r"^([A-Z/ ]+?):\s*(.*)$", line.strip())
        if m:
            lines[m.group(1).strip()] = m.group(2).strip()
    return {
        "provider": provider,
        "model": model,
        "original": draft,
        "constraints_kept": kept,
        "packet": lines or {"PROMPT": text},
        "raw": text,
    }


def render(result: dict) -> str:
    order = ["GOAL", "DONE WHEN", "EFFORT", "AUTONOMY", "SHAPE", "TOOLS/SKILLS", "CONTEXT", "COMPACT", "PROMPT"]
    p = result["packet"]
    out = [f"{k}: {p[k]}" for k in order if k in p]
    extra = [f"{k}: {v}" for k, v in p.items() if k not in order]
    out += extra
    if result["constraints_kept"]:
        out.append("CONSTRAINTS KEPT: " + " | ".join(result["constraints_kept"]))
    out.append(f"(optimized by {result['model']} for {PROVIDERS[result['provider']]['name']}; not sent)")
    return "\n".join(out)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--draft", help="the draft request; default reads stdin")
    ap.add_argument("--provider", choices=sorted(PROVIDERS), default=os.environ.get("OPTIMIZE_PROVIDER", "generic"))
    ap.add_argument("--endpoint", default=DEFAULT_ENDPOINT, help="OpenAI-compatible base URL (default: local Ollama)")
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--json", action="store_true", help="machine-readable output for harness integration")
    ap.add_argument("--prompt-only", action="store_true", help="print only the rewritten PROMPT line")
    a = ap.parse_args()

    draft = a.draft if a.draft is not None else sys.stdin.read()
    draft = draft.strip()
    if not draft:
        print("optimize: empty draft", file=sys.stderr)
        return 2
    if len(draft) > 8000:
        print("optimize: draft over 8,000 characters; optimize the request, not the document", file=sys.stderr)
        return 2
    try:
        result = packet(draft, a.provider, a.endpoint, a.model)
    except urllib.error.URLError as e:
        print(f"optimize: cannot reach {a.endpoint} ({e.reason}); set OPTIMIZE_ENDPOINT/OPTIMIZE_MODEL", file=sys.stderr)
        return 3
    if a.json:
        print(json.dumps(result, indent=2))
    elif a.prompt_only:
        print(result["packet"].get("PROMPT", result["raw"]))
    else:
        print(render(result))
    return 0


if __name__ == "__main__":
    sys.exit(main())
