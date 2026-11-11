---
name: journal-entry
description: Record an entry in a .jules/ persona journal (bolt.md, palette.md, sentinel.md, tux.md). Use this every time you write a journal entry. The helper script stamps the real current date automatically, so entries are never misdated.
---

# Journal entries: never type the date yourself

Journal entries in `.jules/` were repeatedly misdated when agents wrote
the `## YYYY-MM-DD - Title` heading by hand, including entries dated
weeks or years in the future. The heading date must come from the system
clock, not from you. `scripts/journal.py` owns the date; you own the words.

## Rules

1. **Never** write or edit a journal heading date by hand. Not today's
   date as you believe it to be, not a date copied from a neighboring
   entry, not an incremented date. If a date did not come out of
   `scripts/journal.py`, it is wrong by construction.
2. **Never** fix a wrong date by editing the heading yourself. Report it;
   corrections go through a reviewed change.
3. Performance claims in an entry still need before/after measurements,
   same as always. The script fixes dates, not evidence.

## How to add an entry

Formatted journals (Learning/Action style, e.g. bolt, palette):

```bash
python3 scripts/journal.py bolt \
  --title "Avoid X in hot path" \
  --learning "What you measured or discovered" \
  --action "What you changed and where"
```

Freeform journals (e.g. tux, sentinel): write the body to a temp file,
then:

```bash
python3 scripts/journal.py tux --title "Short title" --body-file /tmp/entry.md
```

The script appends to the end of `.jules/<persona>.md`:

```markdown
## <real today's date> - Short title

<body>
```

Match your journal's existing title convention (some wrap the title in
`[brackets]`); pass the title exactly as it should appear after the date.

## Verify afterwards

```bash
python3 scripts/journal.py --check-last <your-persona>
```

This fails if the latest entry in your journal is future-dated. Run it
before opening your PR; a future-dated entry will block the PR at review
anyway.

(`--check` without `--last` scans every heading in every journal. Some
journals still carry legacy future-dated entries from before this
tooling existed; those are tracked cleanup work, not yours to fix inside
an unrelated PR.)
