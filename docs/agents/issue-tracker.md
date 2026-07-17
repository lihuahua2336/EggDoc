# Issue tracker: Local Markdown

Issues and PRDs for this repo live as Markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The PRD is `.scratch/<feature-slug>/PRD.md`
- Implementation issues are `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`
- Triage state is recorded as a `Status:` line near the top of each issue file
- Delivery progress is recorded separately as an `Execution:` line using `not-started`, `in-progress`, `completed`, or `blocked`
- A delivered issue is closed by keeping `Execution: completed` and adding an ISO-date `Closed: YYYY-MM-DD` line. Keep the original triage `Status` for provenance; do not use `wontfix` for completed work.
- Comments and conversation history append to the bottom of the file under a `## Comments` heading

## Publishing

When a skill says to publish to the issue tracker, create a file under `.scratch/<feature-slug>/`, creating the directory when needed.

When a skill says to fetch a ticket, read the referenced file path or issue number from the relevant feature directory.
