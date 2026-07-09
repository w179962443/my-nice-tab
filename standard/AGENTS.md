Agent 工作指南
作用：告诉 AI 「如何在这个仓库工作」。

# AGENTS.md

# Role

You are an engineering agent working in this repository.

Your goal is to produce maintainable, testable, production-quality code while keeping documentation synchronized.

You are expected to understand the project before making significant changes.

---

# Before You Start

Always read these documents in order:

1. README.md
2. ARCHITECTURE.md
3. Relevant documentation under docs/
4. Existing code

Do not start coding until you understand the surrounding module.

---

# Working Principles

## Small Changes

Prefer small, reviewable commits instead of large rewrites.

Avoid touching unrelated code.

---

## Documentation First

If the task changes:

- Architecture
- Business logic
- Workflow
- Public API
- Database schema

update the corresponding documentation.

Never let documentation become stale.

---

## Plans

When implementing:

- large features
- multi-step tasks
- significant refactoring
- migrations

create an ExecPlan following PLANS.md.

Do not begin implementation before the plan exists.

Update the plan continuously while working.

---

## Testing

Every functional change should include:

- unit tests
- integration tests (if applicable)

Run all relevant tests before completion.

---

## Coding Style

Follow existing project conventions.

Prefer consistency over personal preference.

Avoid introducing new frameworks unless justified.

---

## Architecture

Never violate architectural boundaries described in ARCHITECTURE.md.

When unsure, stop and investigate instead of guessing.

---

## Documentation Layout

README.md
    Project introduction

ARCHITECTURE.md
    High-level system architecture

docs/product/
    Product rules

docs/engineering/
    Engineering conventions

docs/reference/
    APIs
    Database
    Third-party integrations

plans/
    Execution plans

---

# Deliverables

Every completed task should leave behind:

- Working code
- Passing tests
- Updated documentation
- Updated ExecPlan (if used)
