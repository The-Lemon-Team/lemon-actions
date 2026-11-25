# Bounty Verification & Points Awarding Rule

## Core Rule: Points Are Awarded Only After Verification
- **Never credit/mint bounty points (`AP`, `GAP`, `FP`, or any tower/emitter reward)** and **never mark a bounty task as `COMPLETED` / `Done`** at implementation time alone.
- A task must remain **`IN_PROGRESS`** (or awaiting review/verification) until all of the following are satisfied:
  1. Required automated tests and builds pass without skipped or relaxed assertions.
  2. Visual/UX or functional behavior has been verified on the running app / stand (or explicitly accepted by the user).
  3. Final step(s) in the task checklist are verified and accepted.

## Required Lifecycle
1. **Claim (`TASK_CLAIMED_BY_TOWER`)**: Task status becomes `IN_PROGRESS`.
2. **Implementation (`TASK_STEP_UPDATED`)**: Engineering steps may advance to `IN_PROGRESS` or `DONE`, while the final verification/acceptance step remains `PENDING` or `IN_PROGRESS` and the overall task status stays **`IN_PROGRESS`**.
3. **Verification & Acceptance (`TASK_COMPLETED` + `REWARD_MINTED`)**: Only *after* verification passes and acceptance is confirmed, transition the task to `COMPLETED` / `Done` and emit the reward transaction (`AP` / `GAP` / `FP`).
