# Claude Code Project Guide

This project uses shared AI workflow docs and project-scoped Claude Code skills.

Before working on this repo, read:

1. `docs/AI_SKILLS.md`
2. `.claude/skills/xiao-e-project-context/SKILL.md`
3. The task-specific skill under `.claude/skills/`

## Core Rules

- Daily conversation can stay natural.
- Long output should go through RTK first.
- Development tasks should inspect the project directly before changing files.
- Do not rely on WSL/RTK Git status for final commit or push decisions.
- Before commit or push, use Windows PowerShell Git as the source of truth:
  - `git status --short`
  - `git diff`
  - `git log --oneline --decorate -3`
  - `git rev-list --left-right --count origin/main...main`
  - `git rev-list --left-right --count wechat/main...main`
- Do not push with unexplained changes.
- When pushing `main`, push both remotes:
  - `origin/main`
  - `wechat/main`

## Local Claude Config

Claude Code should use `.claude/skills/` as the project-scoped skill entrypoint.

`docs/ai-skills/` remains the cross-AI source copy. Keep both directories synchronized when changing skills.

Keep `.claude/settings.json`, `.claude/settings.local.json`, and `.claude/worktrees/` local and untracked. They contain personal model, permission, or worktree state and should not be committed.
