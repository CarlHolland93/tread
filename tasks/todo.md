# Portfolio clarity and checks

- [x] Fetch `origin/main` and prepare an isolated worktree.
- [x] Clarify the local prototype status and experimental wear scores in the README.
- [x] Add CI for the existing lint and production build commands.
- [x] Install with the frozen lockfile and run lint and build.
- [x] Review the diff and record verification results and caveats.

## Review

- Added a read-only GitHub Actions check for pushes, pull requests, and manual runs, using Node.js 22 and pnpm 10.32.1.
- Documented local prototype status, experimental wear scores, and the existing validation commands. The recorded GIF remains the demo.
- `pnpm install --frozen-lockfile`, `pnpm lint`, and `pnpm build` passed locally with Node.js 25.8.2 and pnpm 10.32.1. `git diff --check` passed.
- [PR #1](https://github.com/CarlHolland93/tread/pull/1) merged after both GitHub Actions checks passed on Node.js 22.
- The existing build reports one JavaScript chunk slightly above 500 kB. This does not fail the build, and bundle optimization is outside this change.
- No application code, dependencies, lockfile, live hosting, or API integration changed. No camera or live-model calls were exercised.
