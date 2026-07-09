作用：告诉 AI 「整个项目长什么样」。


# Architecture

This document describes the high-level architecture of this repository.

It is intentionally short.

It explains where things are and why they exist.

Do not put implementation details here.

---

# Bird's Eye View

The system consists of four layers.

Client

↓

API Layer

↓

Business Layer

↓

Infrastructure Layer

↓

Database

---

# Code Map

src/

api/
    HTTP APIs

service/
    Business logic

repository/
    Database access

domain/
    Domain models

scheduler/
    Scheduled jobs

worker/
    Background workers

common/
    Shared utilities

config/
    Configuration

tests/
    Test cases

docs/
    Documentation

---

# Responsibilities

API

Receives requests.

Does validation.

Never contains business logic.

---

Service

Implements business rules.

Coordinates repositories.

No HTTP concepts.

---

Repository

Database only.

No business logic.

---

Domain

Represents business entities.

No infrastructure dependencies.

---

# Architecture Invariants

These rules must never be broken.

• Service never imports API.

• Repository never imports Service.

• Domain never depends on Infrastructure.

• Business logic belongs only in Service.

• Database access belongs only in Repository.

---

# Boundaries

External systems are accessed only through adapters.

Examples:

Payment Gateway

Redis

Message Queue

Email

Never let external SDKs leak into business logic.

---

# Cross-Cutting Concerns

Logging

Error handling

Configuration

Authentication

Authorization

Observability

Caching

These are shared across modules.

---

# Adding New Modules

Every new module should answer:

What responsibility does it own?

Which layer does it belong to?

Who is allowed to call it?

What dependencies are forbidden?
