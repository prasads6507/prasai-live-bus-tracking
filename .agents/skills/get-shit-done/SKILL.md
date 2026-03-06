---
name: get-shit-done
description: "Implements the GSD (Get Shit Done) rigorous phase-based development workflow. Use when the user requests /gsd commands to enforce deep context engineering, XML atomic planning, and multi-agent-like orchestration."
risk: safe
date_added: "2026-03-04"
---

# Get Shit Done (GSD) Workflow Skill

This skill transforms you into a strict GSD Orchestrator. The GSD framework forces you to stop guessing and start planning, relying on highly structured markdown files to act as a permanent memory bank.

## Core Philosophy
1. **Never write code first.** Always research and plan.
2. **Context is everything.** All decisions, requirements, and state must be written to `.gsd/` context files.
3. **Spec-Driven Development.** Every phase is grounded in a specification (e.g., `PROJECT.md`, `REQUIREMENTS.md`).
4. **Decoupled Planning & Execution.** Research and planning are strictly separated from execution.
5. **Rigorous Verification (Nyquist).** A strict "PASS/FAIL" loop for all phase outputs.

## Folder Structure
All GSD context files should be stored in a `.gsd/` folder at the root of the user's project.

## Commands

### Project Initialization & discovery
- `/gsd:new-project`: Initialize a new project with discovery questions and research. Creates `.gsd/PROJECT.md`, `.gsd/REQUIREMENTS.md`, and `.gsd/ROADMAP.md`.

### Phase Management
- `/gsd:discuss-phase [phase]`: Lock in preferences and specifications for a specific phase (saved to `.gsd/{phase}-CONTEXT.md`).
- `/gsd:plan-phase [phase]`: Conduct research and generate an executable plan in `.gsd/{phase}-PLAN.md` using the Strict XML Format.
- `/gsd:execute-phase [phase]`: Execute the plan tasks one-by-one with immediate verification and git commits.
- `/gsd:validate-phase [phase]`: Perform retroactive Nyquist validation to ensure integrity mid- or post-phase.

### Verification & Auditing
- `/gsd:verify-work`: Perform manual User Acceptance Testing (UAT) and verification.
- `/gsd:audit-milestone`: Report on status and compliance across all phases in a milestone.

### Milestone Lifecycle
- `/gsd:new-milestone`: Transition to the next major project milestone.
- `/gsd:complete-milestone`: Finalize and wrap up the current milestone.

### Utility Commands
- `/gsd:add-phase`: Add a new phase to the roadmap.
- `/gsd:add-tests`: Specifically focus on generating/adding tests for current work.
- `/gsd:add-todo`: Add a manual task to the `.gsd/TODO.md`.
- `/gsd:check-todos`: Review status of manual and automated todos.
- `/gsd:diagnose-issues`: Deep-dive into architectural or implementation blockers.
- `/gsd:cleanup`: Clean up temporary files or stale context.

## Strict XML Format for Plans (`{phase}-PLAN.md`)
You MUST format every actionable step as an XML block:

```xml
<task type="auto">
  <name>Brief descriptive name</name>
  <files>Comma separated list of files to create/modify</files>
  <action>
    Detailed implementation steps.
  </action>
  <verify>Command or manual step to verify success</verify>
  <done>The definition of done. What defines success for this specific atomic task?</done>
</task>
```

---
**Agent Directive:** When you recognize a `/gsd` command, immediately state "GSD Mode Activated" and begin the corresponding workflow sequence.
