#!/usr/bin/env python3
"""Append an entry to a .jules/ persona journal, stamped with the real date.

Usage:
    python3 scripts/journal.py <persona> --title "Short title" \
        --learning "What was learned" --action "What was done"

    python3 scripts/journal.py <persona> --title "Short title" \
        --body-file entry.md

    python3 scripts/journal.py --check [persona ...]

The date in the entry heading ALWAYS comes from the system clock
(America/New_York) at the moment the script runs. There is deliberately
no --date option and no way to type a date by hand: journal entries were
repeatedly misdated (including future dates weeks or years ahead) when
agents wrote the heading themselves. Write the entry text; the script
owns the date.

<persona> is a journal name under .jules/ (bolt, palette, sentinel, tux)
or a direct path to a journal markdown file.

--check scans journal headings and fails (exit 1) if any entry is dated
after today (America/New_York). With no personas it checks every
.jules/*.md file. Note some journals still carry legacy future-dated
entries from before this tooling existed; --check-last checks only the
final (most recently appended) entry per journal, which is the right
gate for "is the entry I just added dated correctly".
"""

import argparse
import re
import sys
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

TZ = ZoneInfo("America/New_York")
HEADING_RE = re.compile(r"^## (\d{4}-\d{2}-\d{2})\b", re.MULTILINE)


def today() -> date:
    return datetime.now(TZ).date()


def journal_path(persona: str) -> Path:
    p = Path(persona)
    if p.suffix == ".md" and p.exists():
        return p
    candidate = Path(".jules") / f"{persona}.md"
    if candidate.exists():
        return candidate
    raise SystemExit(f"error: journal not found for '{persona}' "
                     f"(looked for {candidate})")


def read_body(args) -> str:
    if args.learning or args.action:
        parts = []
        if args.learning:
            parts.append(f"**Learning:** {args.learning.strip()}")
        if args.action:
            parts.append(f"**Action:** {args.action.strip()}")
        return "\n".join(parts)
    if args.body_file:
        return Path(args.body_file).read_text(encoding="utf-8").strip()
    if args.body:
        return args.body.strip()
    if not sys.stdin.isatty():
        return sys.stdin.read().strip()
    raise SystemExit("error: no entry body given "
                     "(use --learning/--action, --body, --body-file, or stdin)")


def append_entry(persona: str, title: str, body: str) -> str:
    path = journal_path(persona)
    heading = f"## {today().isoformat()} - {title.strip()}"
    text = path.read_text(encoding="utf-8")
    if not text.endswith("\n"):
        text += "\n"
    entry = f"\n{heading}\n\n{body}\n"
    path.write_text(text + entry, encoding="utf-8")
    return heading


def resolve_files(personas: list[str]) -> list[Path]:
    if personas:
        return [journal_path(p) for p in personas]
    return sorted(Path(".jules").glob("*.md"))


def check(personas: list[str]) -> int:
    files = resolve_files(personas)
    if not files:
        print("no journals found")
        return 1
    bad = 0
    for f in files:
        for m in HEADING_RE.finditer(f.read_text(encoding="utf-8")):
            d = date.fromisoformat(m.group(1))
            if d > today():
                print(f"FUTURE-DATED: {f}: {m.group(1)} (today is {today()})")
                bad += 1
    if bad:
        print(f"{bad} future-dated entr{'y' if bad == 1 else 'ies'} found")
        return 1
    print(f"OK: no future-dated entries (today is {today()})")
    return 0


def check_last(personas: list[str]) -> int:
    files = resolve_files(personas)
    if not files:
        print("no journals found")
        return 1
    bad = 0
    for f in files:
        matches = HEADING_RE.findall(f.read_text(encoding="utf-8"))
        if not matches:
            continue
        last = date.fromisoformat(matches[-1])
        if last > today():
            print(f"FUTURE-DATED last entry: {f}: {last} (today is {today()})")
            bad += 1
    if bad:
        return 1
    print(f"OK: latest entries are not future-dated (today is {today()})")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("persona", nargs="?",
                    help="journal name under .jules/ (bolt, palette, sentinel, tux)")
    ap.add_argument("--title", help="entry title (the script adds the date)")
    ap.add_argument("--learning", help="Learning text (formatted journals)")
    ap.add_argument("--action", help="Action text (formatted journals)")
    ap.add_argument("--body", help="freeform entry body")
    ap.add_argument("--body-file", help="file containing the entry body")
    ap.add_argument("--check", action="store_true",
                    help="fail if any journal entry is future-dated")
    ap.add_argument("--check-last", action="store_true",
                    help="fail only if a journal's latest entry is future-dated")
    ap.add_argument("more_personas", nargs="*",
                    help="extra personas for --check")
    args = ap.parse_args()

    if args.check or args.check_last:
        personas = ([args.persona] if args.persona else []) + args.more_personas
        return check_last(personas) if args.check_last else check(personas)

    if not args.persona:
        ap.error("persona is required unless --check is used")
    if not args.title:
        ap.error("--title is required")
    body = read_body(args)
    if not body:
        raise SystemExit("error: entry body is empty")
    heading = append_entry(args.persona, args.title, body)
    print(f"Appended to {journal_path(args.persona)}:")
    print(heading)
    return 0


if __name__ == "__main__":
    sys.exit(main())
