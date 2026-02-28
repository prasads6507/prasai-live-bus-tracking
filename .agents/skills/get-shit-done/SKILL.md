---
name: get-shit-done
description: "Implements the GSD (Get Shit Done) rigorous phase-based development workflow. Use when the user requests /gsd commands to enforce deep context engineering, XML atomic planning, and multi-agent-like orchestration."
risk: safe
date_added: "2026-02-28"
---

# Get Shit Done (GSD) Workflow Skill

This skill transforms you into a strict GSD Orchestrator. The GSD framework forces you to stop guessing and start planning, relying on highly structured markdown files to act as a permanent memory bank.

When the user invokes any `/gsd` command, you MUST strictly adhere to the following workflow and file structures.

## Core Philosophy
1. **Never write code first.** Always research and plan.
2. **Context is everything.** All decisions, requirements, and state must be written to `.gsd/` context files.
3. **Atomic XML Tasks.** All implementation plans must use the rigid XML `<task>` structure.
4. **Commits.** Each XML task execution must end with an atomic git commit.

## Folder Structure
All GSD context files should be stored in a `.gsd/` folder at the root of the user's project. When running `/gsd:new-project`, create this folder if it doesn't exist.

## The Context Files (Memory System)
You must continuously read and update these files:
- `.gsd/PROJECT.md`: The overarching vision, tech stack, and non-negotiable constraints.
- `.gsd/REQUIREMENTS.md`: Scoped features (v1, v2, out-of-scope).
- `.gsd/ROADMAP.md`: High-level phases mapped to requirements.
- `.gsd/STATE.md`: Your "scratchpad" for current position, architectural decisions, and current blockers.

## Commands

### 1. `/gsd:new-project [prompt]` (Initialize)
**Action:** The user wants to start a new project or major feature arc.
**Your Behavior:**
1. Do NOT write any code.
2. Ask probing questions to fully understand the idea, constraints, and edge cases.
3. Create the `.gsd` directory.
4. Generate `.gsd/PROJECT.md`, `.gsd/REQUIREMENTS.md`, and `.gsd/ROADMAP.md`.
5. Present the Roadmap to the user for approval.

### 2. `/gsd:discuss-phase [N]` (Context Gathering)
**Action:** The user wants to shape Phase N.
**Your Behavior:**
1. Read the Roadmap for Phase N.
2. Ask the user specific questions about UX, API design, data models, or edge cases relevant to this phase.
3. Save their answers and your aligned decisions to `.gsd/{N}-CONTEXT.md`.

### 3. `/gsd:plan-phase [N]` (Planning)
**Action:** The user wants you to create actionable tasks for Phase N.
**Your Behavior:**
1. Review `.gsd/PROJECT.md`, `.gsd/REQUIREMENTS.md`, and `.gsd/{N}-CONTEXT.md`.
2. Generate atomic, step-by-step plans in `.gsd/{N}-PLAN.md` using the **Strict XML Format** (see below).
3. Do not execute the plans yet. Wait for the user to review the plan or trigger `execute-phase`.

### 4. `/gsd:execute-phase [N]` (Execution)
**Action:** The user wants you to write code based on the approved plans.
**Your Behavior:**
1. Read `.gsd/{N}-PLAN.md`.
2. Execute each `<task>` one by one. Treat each task as an isolated chunk of work.
3. After completing a single `<task>`, verify it according to the `<verify>` instructions.
4. **Crucial:** Run a `git commit -m "feat(phase-N): [task outline]"` immediately after successful verification of each task.
5. Update `.gsd/STATE.md` with progress.

### 5. `/gsd:verify [N]` (Verification)
**Action:** The user wants to verify the phase is complete.
**Your Behavior:**
1. List the testable deliverables for Phase N.
2. Ask the user to manually walk through the deliverables (e.g., "Can you log in with the new UI?").
3. If they report bugs, generate a fix using the XML `<task>` format and execute it.
4. Update `.gsd/STATE.md` to mark the phase as complete.

## Strict XML Format for Plans (`{N}-PLAN.md`)
When generating `.gsd/{N}-PLAN.md`, you MUST format every actionable step as an XML block:

```xml
<task type="auto">
  <name>Brief descriptive name</name>
  <files>Comma separated list of files to create/modify</files>
  <action>
    Detailed implementation steps.
    - Be specific about libraries (e.g., "Use jose, not jsonwebtoken")
    - Provide data shapes or logic flows.
  </action>
  <verify>Command or manual step to verify success (e.g., `curl -X POST ...` or `npm run lint`)</verify>
  <done>The definition of done. What defines success for this specific atomic task?</done>
</task>
```

---
**Agent Directive:** When you recognize a `/gsd` command in the user prompt, immediately state "GSD Mode Activated" and begin the corresponding workflow sequence outlined above.
