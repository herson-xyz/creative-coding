---
name: ship
description: Commit, push, and deploy the creative-coding site to fly.io (lab.madebyherson.dev).
argument-hint: [optional commit message]
---

# Ship

Commit any uncommitted changes, push to origin, and deploy to fly.io.

## Step 1 — Check for changes

Run `git status` and `git diff`. If there are no uncommitted changes and nothing staged, skip to Step 3 (push + deploy in case a prior commit wasn't deployed).

## Step 2 — Commit

Stage all modifications:

```bash
git add -A
```

Derive a commit message:
- If the user provided arguments (`$ARGUMENTS`), use that as the message.
- Otherwise, inspect the diff to write a short, specific message. Prefer naming what changed: e.g. `Add Week 19 sketch: Primordial` or `Update projects.json description`. Avoid generic messages like "update files".

Commit with:

```
<message>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

## Step 3 — Push

```bash
git push origin main
```

## Step 4 — Deploy

```bash
fly deploy
```

This builds the Docker image and deploys to `creative-coding-lab` (lab.madebyherson.dev). Wait for the command to complete and report whether it succeeded.

## Step 5 — Report

Tell the user:
- Whether a commit was made (and the message used), or skipped
- Whether the push succeeded
- Whether the deploy succeeded and the live URL: https://lab.madebyherson.dev
