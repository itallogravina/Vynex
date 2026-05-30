# Agent Execution Rules

## Task execution flow

When executing any task:

1. Read:
   * PROJECT.md
   * STATE.md
   * feature/spec.md
   * feature/tasks.md
   * feature/state.md
2. Before coding:
   * verify if task was already completed
   * verify dependencies
   * verify existing files
3. After completing a task:
   * update feature/state.md
   * update feature/task.md
   * mark task as completed in tasks.md
   * append technical notes
   * register created files
   * register architectural decisions
4. Never execute a task twice unless explicitly requested.
5. Always treat feature/state.md as source of truth.
6. If task is completed:
   * do not recreate files
   * do not overwrite implementations
   * only validate consistency
7. Keep responses concise and avoid re-reading unrelated specs.
