# Weedoshi Agent Rules

## Completion rule
- If a task modifies project files, the task is not complete until changes are committed and pushed to GitHub.
- Required end-of-task sequence:
  1. Run relevant checks (`type-check`, tests, or lint as appropriate).
  2. Commit focused changes.
  3. Push commit(s) to the remote GitHub repository.
  4. Only then report the task as done.
