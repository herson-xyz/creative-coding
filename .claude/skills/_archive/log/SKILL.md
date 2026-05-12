---
name: log
description: Log this creative-coding session — writes a session transcript to the Obsidian vault and restructures the AI sessions note. Run at end of session instead of /wrap.
argument-hint: [optional focus area]
---

# Session Log

Write the session transcript and update the AI sessions note in Obsidian. Scoped to the creative-coding project.

## Project context

- **Project name**: Creative Coding
- **Tag**: `#creative-coding`
- **Canonical name for frontmatter**: `Creative Coding`
- **Synapse vault**: `/Users/hersonguerrerohuh/Development/GitHub/Synapse`

---

## Step 1 — Session transcript

Write a structured markdown file to the vault at:

```
/Users/hersonguerrerohuh/Development/GitHub/Synapse/_inputs/media files/markdown/ai/YYYY/MM/YYYY-MM-DD_HHMM_${CLAUDE_SESSION_ID}.md
```

Use the current date and time. Structure:

```markdown
---
date: YYYY-MM-DD
time: HH:MM
session_id: <session_id>
cwd: <working directory>
---

## Session Transcript

**User:**
{Summarized — capture intent, requirements, decisions}

**Assistant:**
{Summarized — fold tool calls into the narrative, capture substance and outcomes}

... (continue for each turn)
```

Rules:
- Summarized, not verbatim — a reader should understand what happened without seeing the raw conversation
- Fold tool calls into the assistant narrative
- Merge adjacent turns if they form one logical exchange
- Use `**User:**` and `**Assistant:**` as turn markers

---

## Step 2 — AI sessions note

The ai sessions dated file lives at:

```
/Users/hersonguerrerohuh/Development/GitHub/Synapse/calendar notes/_ai sessions/YYYY/MM/YYYY-MM-DD.md
```

### Detect unprocessed prompts

A prompt is **unprocessed** if it is a top-level numbered bullet with no `Prompt:` child:
```
1. The user's raw prompt text
```

A prompt is **processed** if it has a `1. Prompt:` child and a session link on the title line. Do not modify processed prompts.

### Read or create the file

Read today's file. If it doesn't exist, create it:

```markdown
---
date: YYYY-MM-DD
project: []
---
```

### Find and match

Scan for unprocessed prompts. Using this session's context, match those that relate to this session's work.

If none match or none exist, create a new entry at the end of the file.

### Restructure each matched prompt

```
N. #creative-coding Synthesized Title | [[YYYY-MM-DD_HHMM_SESSION_ID|Transcript]]
	1. Prompt:
		1. Original prompt text
	2. 📝 **Project Updates
		- General
			- ✅ Shipped: ...
			- 🤝 Decision: ...
			- 🧠 Learned: ...
			- ➡️ Next: ...
	3. 🛠️ **Product Updates
		- [[Doc Name]]
			- 📄 Updated/Created: ...
```

Rules:
- **Indentation**: tabs
- **Session link**: inline on the title line after ` | `, linking to the session note stem with display alias `Transcript`
- **Prompt child**: `1. Prompt:` first, original text as its child — makes it collapsible in Obsidian
- **Sections**: omit `📝 **Project Updates` or `🛠️ **Product Updates` entirely if no content for that section
- **Duplicate prevention**: skip any prompt that already has this session ID linked on its title line
- For creative-coding, there are no formal task stories — use `General` for all project updates

### Update frontmatter

Add `Creative Coding` to the `project` list in frontmatter if not already present. Do not remove existing entries.

### Report

Tell the user:
- How many unprocessed prompts were found and matched
- Which were restructured and which session link was attached
- Whether a new entry was created
- What the updated `project` frontmatter list is

---

## Step 3 — Commit and push Synapse

Stage and commit only the AI sessions note — do not `git add -A`:

```bash
cd /Users/hersonguerrerohuh/Development/GitHub/Synapse
git add "calendar notes/_ai sessions/YYYY/MM/"
```

Note: `_inputs/media files/` is a symlink to an external drive — git cannot stage through it, so the session transcript is intentionally not committed.

Commit message:

```
log: ai sessions — YYYY-MM-DD

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

Then push to `origin main`. Report whether the commit and push succeeded.

Note: the creative-coding repo itself is handled by `/ship` — do not commit or push it here.

---

## Focus area

If the user provided arguments: $ARGUMENTS

Use this to emphasise certain aspects of the session in the session transcript and updates summary.

## Important

- Write all files using the Write tool
- Create parent directories if needed (`Bash mkdir -p`)
- Do NOT call `claude -p` or any subprocess — you already have full context
