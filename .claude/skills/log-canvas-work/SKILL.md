---
name: log-canvas-work
description: Log canvas work as a journal entry — reads the full canvas (and one level of embedded canvases), detects what changed via git diff, and writes a narrative entry to today's AI sessions note capturing how the canvas evolved as a living design document.
argument-hint: [canvas path override] [optional focus]
---

# Log Canvas Work

Write a journal entry that captures how the canvas changed this session and what that reveals about the design's evolution. This is not a product log or shipping summary — it is a record of the canvas as a living document.

The entry should let someone reading it months later understand what the canvas looked like before, what changed, and why — grounded in the actual canvas content and session context.

---

## Step 0 — Resolve context

- **Repo root**: `git rev-parse --show-toplevel` (should be creative-coding)
- **Project tag**: `#creative-coding`
- **Synapse vault**: `/Users/hersonguerrerohuh/Development/GitHub/Synapse`
- **AI sessions note**: `{Synapse}/ai sessions/YYYY/MM/YYYY-MM-DD.md` (use today's date)
- **Canvas file**: Infer from CLAUDE.md or session context. For Primordial: `_publish/projects/Primordial.canvas`. If `$ARGUMENTS` contains a path ending in `.canvas`, use that instead.

---

## Step 1 — Read the full canvas context

Read the canvas JSON with the Read tool. Parse it to understand:
- What nodes exist, what they contain, how they're connected
- The overall structure — what the canvas documents, how it's organized
- Color conventions, edge topology, any group structure

Then identify any embedded child canvases: nodes of type `file` whose `file` path ends in `.canvas`. Read each one (one level deep only — do not recurse into canvases found inside child canvases). Note what they contain.

This full-canvas read is the design context you'll need to write a meaningful entry.

---

## Step 2 — Detect canvas changes

### 2a — Run git diff

```bash
git -C {Synapse} diff HEAD -- "{relative_canvas_path}"
```

Parse the diff to classify what changed this session:

- Line starting with `+` containing `"id":` → candidate **added** item
- Line starting with `-` containing `"id":` → candidate **removed** item
- Same `id` in both → **modified** (compare fields to determine: repositioned / content updated / recolored)
- Nodes have `"type":` in the same line; edges have `"fromNode":`

For each changed item extract: id, type, title (first `# heading` for text nodes, basename for file nodes, URL for link nodes), and what changed.

### 2b — Fallback when diff is empty

If the git diff returns nothing, check the most recent commit:

```bash
git -C {Synapse} log --oneline -3 -- "{relative_canvas_path}"
git -C {Synapse} diff HEAD~1 HEAD -- "{relative_canvas_path}"
```

If that commit covers work from the current session, use it. Otherwise reconstruct from session context and note that the canvas diff was unavailable.

### 2c — Scope the diff to this session

The diff against HEAD may include accumulated changes from multiple prior sessions if the canvas hasn't been committed recently. Use session context to identify which changes belong to this session specifically. Focus the entry on those.

---

## Step 3 — Write the journal entry

### What to write

Write a narrative that answers: what changed in the canvas this session, and what does that reveal about how the design is evolving?

Approach this as an observer writing about the canvas, not as someone filing a delivery report. Describe what changed, why it changed (using session context), and what it means for the canvas as a document — what it captures now that it didn't before, or what it no longer tries to hold together.

Use concrete node titles and parameter names. Reference the canvas structure — where nodes sit relative to each other, what edges connect them, what color conventions mean. If a child canvas is relevant to the changes, describe how it fits in.

Do not use "✅ Shipped", "🤝 Decision", or any product/task management vocabulary. Do not write "we built" or "we decided." Write what the canvas shows now and how it got there.

Aim for 2–4 paragraphs. Each paragraph should cover one conceptual thread. If the session was narrow (one node updated), one tight paragraph may be enough.

### Title

Short, sentence case, 5–8 words. Capture what the canvas change was fundamentally about — not what was shipped, but what the canvas now documents differently.

### Entry format

```
N. [[Canvas Filename.canvas|Canvas Name]] - Title | [[YYYY-MM-DD_HHMM_SESSION_ID|Transcript]]
	- {Paragraph one}
	- {Paragraph two, if needed}
	- {Paragraph three, if needed}
```

- Canvas wikilink uses a display name: `[[Primordial.canvas|Primordial]]`, not the raw filename
- ` - ` separates the canvas link from the title
- Title uses full words — no abbreviations (e.g. "Iteration 4", not "Iter 4")

**Formatting rules**:
- Indentation: **tabs** (not spaces)
- Each paragraph is a bullet child of the top-level entry
- Session link: `[[YYYY-MM-DD_HHMM_SESSION_ID|Transcript]]` — use `$CLAUDE_SESSION_ID` and current time from `date "+%H%M"`
- **Duplicate check**: if `$CLAUDE_SESSION_ID` already appears as a wikilink in the file, stop — already logged

**Writing method**: use Python to append to avoid emoji encoding issues:

```python
with open(path, "a", encoding="utf-8") as f:
    f.write(entry)
```

### Transcript file

Before writing the sessions note entry, create the transcript file at:

```
{Synapse}/_inputs/media files/markdown/ai/YYYY/MM/YYYY-MM-DD_HHMM_SESSION_ID.md
```

Frontmatter:

```markdown
---
date: YYYY-MM-DD
time: HH:MM
session_id: SESSION_ID
cwd: {repo_root}
---
```

Body: a series of `**User:**` / `**Assistant:**` exchange blocks — one per meaningful exchange in the session. Each block summarizes what was asked and what was done. Write from session context; do not invent exchanges that didn't happen. End with the canvas work that this skill is logging.

---

## Step 4 — Update frontmatter

Add `Creative Coding` to the `project` list in frontmatter if not already present.

---

## Step 5 — Commit and push Synapse

Stage only the AI sessions note:

```bash
git -C {Synapse} add "ai sessions/YYYY/MM/YYYY-MM-DD.md"
```

Commit message:

```
log: canvas journal — YYYY-MM-DD

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

Push to `origin main`. Report success or failure.

---

## Step 6 — Report

```
Logged: "<entry title>" → ai sessions/YYYY/MM/YYYY-MM-DD.md
Canvas diff: {summary of what changed}
Committed: Synapse ({short_sha}) | pushed ✓
```

---

## Arguments

`$ARGUMENTS` may contain:
- A path ending in `.canvas` → override the inferred canvas file
- A focus note → use to shape the title or emphasize a particular aspect of the changes

---

## Important

- Read the canvas JSON before writing — the diff tells you what changed, but the full canvas tells you what it means
- Run git diff via Bash — this is the authoritative source for what changed
- Do NOT call `claude -p` or any subprocess
- The creative-coding repo is handled by `/ship` — do not commit it here
