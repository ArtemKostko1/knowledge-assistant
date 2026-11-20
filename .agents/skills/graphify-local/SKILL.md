---
name: graphify-local
description: Navigate the knowledge-assistant codebase using its local code graph. Locate symbols, dependencies, callers, and relevant tests before reading source files.
---

# Graphify Local

Use the existing local Graphify index to navigate this repository.

## Executable

C:\Users\artik\.local\bin\graphify.exe

## Project

D:\Projects\knowledge-assistant

## Index

graphify-out/graph.json

## Navigation workflow

1. Prefer exact symbol lookup before broad searches.
2. Run Graphify from the repository root.
3. Use `explain` to find a symbol and its immediate connections.
4. Use `query` only for scoped architectural questions.
5. Limit query output to approximately 500-1000 tokens.
6. Open only the relevant source files returned by Graphify.
7. Confirm relationships against the actual source code.
8. Identify directly related tests before making changes.

## Example commands

graphify explain "AuthGuard"

graphify explain "AppUserRepository"

graphify query "AppUserRepository Prisma dependencies" --budget 700

## Restrictions

- Do not rebuild the graph automatically.
- Do not scan the whole repository when a scoped query is sufficient.
- Do not send graph.json or full graph reports to the LLM.
- Do not change source files during navigation-only tasks.
- Treat the graph as potentially stale after code changes.
- Graphify does not replace TypeScript checks, tests, or security review.
- Do not launch subagents for simple graph navigation.
- Report only relevant paths, symbols, dependencies, and confidence limits.
