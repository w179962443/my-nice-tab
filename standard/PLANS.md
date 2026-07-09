作用：告诉 AI 「如何写一个长期执行计划」。

# Execution Plans (ExecPlan)

This document defines how execution plans are written.

Execution plans are living documents.

They must remain up to date throughout implementation.

---

# When to Use

Create an ExecPlan when work involves:

- Large features
- Significant refactoring
- Multiple milestones
- Database migrations
- Cross-module changes
- Multi-day work

Small bug fixes do not require one.

---

# Principles

An ExecPlan must be:

- Self-contained
- Understandable by a newcomer
- Continuously updated
- Observable
- Testable

A reader should be able to finish the work using only:

- the repository
- the ExecPlan

---

# Required Sections

Every ExecPlan should contain:

## Purpose

Why are we doing this?

What will users gain?

---

## Context

Which modules are involved?

Which files matter?

What assumptions exist?

---

## Plan

Describe implementation in chronological order.

Avoid vague language.

---

## Milestones

Split work into independently verifiable stages.

Each milestone should produce working behavior.

---

## Progress

Track current status.

Example

- [x] Database schema

- [x] API endpoints

- [ ] Frontend integration

---

## Decision Log

Every important decision must be recorded.

Decision

Reason

Date

---

## Discoveries

Record unexpected findings.

Examples:

Performance bottlenecks

Library bugs

Better implementation ideas

---

## Validation

Describe exactly how to verify success.

Include:

Commands

Expected output

Behavior

---

## Recovery

Explain how to retry safely.

Explain rollback if necessary.

---

## Retrospective

After completion:

Summarize:

What worked

What changed

Lessons learned
