# Claude Code Project Guide

This project uses shared AI workflow docs instead of committing personal `.claude/` configuration.

Before working on this repo, read:

1. `docs/AI_SKILLS.md`
2. `docs/ai-skills/xiao-e-project-context/SKILL.md`
3. The task-specific skill under `docs/ai-skills/`

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

Keep `.claude/` local and untracked. It should only contain personal Claude Code settings, such as model and local permission preferences. Shared project workflow belongs in `docs/AI_SKILLS.md` and `docs/ai-skills/`.
