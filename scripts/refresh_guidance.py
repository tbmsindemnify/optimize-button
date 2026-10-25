#!/usr/bin/env python3
"""Daily refresh: watch the labs' own guidance pages and the tool catalogs' official pages.

Standard library only. For every URL in guidance/sources.json:
  * fetch the page, strip it to text, hash it
  * if the hash changed since the last run: save a dated text snapshot under guidance/snapshots/,
    append an entry to guidance/CHANGELOG.md with the URL, the size change and the first changed lines
  * remember the hash in guidance/state.json

This job is deterministic and needs no API key. It does NOT rewrite the rules by itself.
A human (or a reviewed agent run that opens a pull request) reads the snapshot diff and edits
guidance/provider-guidance.md and catalog/*.md. That keeps the rules accurate and attributable.

Run:  python3 scripts/refresh_guidance.py            (CI runs this daily; see .github/workflows)
      python3 scripts/refresh_guidance.py --dry-run  (fetch and report, write nothing)
"""
from __future__ import annotations

import argparse
import datetime as dt
import difflib
import hashlib
import html
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCES = ROOT / "guidance" / "sources.json"
STATE = ROOT / "guidance" / "state.json"
CHANGELOG = ROOT / "guidance" / "CHANGELOG.md"
SNAPSHOTS = ROOT / "guidance" / "snapshots"
UA = "optimize-button-refresh/1.0 (+https://github.com/tbmsindemnify/optimize-button)"


def fetch_text(url: str, timeout: float = 30.0) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html,text/plain,*/*"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read(2_000_000)
        charset = resp.headers.get_content_charset() or "utf-8"
    text = raw.decode(charset, errors="replace")
    text = re.sub(r"<(script|style|noscript|svg)[^>]*>.*?</\1>", " ", text, flags=re.S | re.I)
    text = re.sub(r"<br\s*/?>|</(p|div|li|h[1-6]|tr|section|article)>", "\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = html.unescape(text)
    lines = [re.sub(r"[ \t\u00a0]+", " ", l).strip() for l in text.splitlines()]
    lines = [l for l in lines if l]
    return "\n".join(lines)


def slug(url: str) -> str:
    s = re.sub(r"^https?://", "", url)
    s = re.sub(r"[^A-Za-z0-9]+", "-", s).strip("-")
    return s[:120]


def first_changes(old: str, new: str, limit: int = 6) -> list[str]:
    out = []
    for line in difflib.unified_diff(old.splitlines(), new.splitlines(), lineterm="", n=0):
        if line.startswith(("+++", "---", "@@")):
            continue
        if line.startswith(("+", "-")) and len(line) > 3:
            out.append(line[:200])
        if len(out) >= limit:
            break
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    sources = json.loads(SOURCES.read_text())
    state = json.loads(STATE.read_text()) if STATE.exists() else {}
    today = dt.date.today().isoformat()
    changed, failed = [], []

    for group in sources["groups"]:
        for src in group["sources"]:
            url = src["url"]
            try:
                text = fetch_text(url)
            except (urllib.error.URLError, TimeoutError, ValueError) as e:
                failed.append((url, str(e)[:120]))
                continue
            digest = hashlib.sha256(text.encode()).hexdigest()
            prev = state.get(url, {})
            if prev.get("sha256") == digest:
                continue
            snap_dir = SNAPSHOTS / today
            snap = snap_dir / f"{slug(url)}.txt"
            old_text = ""
            if prev.get("snapshot"):
                try:
                    old_text = (ROOT / prev["snapshot"]).read_text()
                except OSError:
                    pass
            delta = first_changes(old_text, text) if old_text else []
            changed.append((group["name"], src.get("title", url), url, len(old_text), len(text), delta, prev.get("checked")))
            if not a.dry_run:
                snap_dir.mkdir(parents=True, exist_ok=True)
                snap.write_text(text)
                state[url] = {"sha256": digest, "checked": today, "snapshot": str(snap.relative_to(ROOT)), "title": src.get("title", "")}

    if not a.dry_run:
        for url in list(state):
            if any(s["url"] == url for g in sources["groups"] for s in g["sources"]):
                state[url]["checked"] = today
        STATE.write_text(json.dumps(state, indent=2, sort_keys=True))
        if changed:
            entry = [f"\n## {today}\n"]
            for grp, title, url, old_len, new_len, delta, last in changed:
                kind = "first snapshot" if not old_len else f"changed ({old_len:,} -> {new_len:,} chars; last seen {last})"
                entry.append(f"- **{grp} / {title}** — {kind} — {url}")
                for d in delta:
                    entry.append(f"    - `{d}`")
            if not CHANGELOG.exists():
                CHANGELOG.write_text("# Guidance changelog\n\nWhat changed on the labs' own pages and the tool catalogs, by day. Snapshots live in `guidance/snapshots/<date>/`. Rules in `provider-guidance.md` and `catalog/` are updated by a reviewed pull request, not by this log.\n")
            with CHANGELOG.open("a") as f:
                f.write("\n".join(entry) + "\n")

    print(f"{today}: {len(changed)} changed, {len(failed)} failed, {sum(len(g['sources']) for g in sources['groups'])} watched")
    for grp, title, url, *_ in changed:
        print(f"  changed  {grp} / {title}  {url}")
    for url, err in failed:
        print(f"  failed   {url}  {err}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
