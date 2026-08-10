# LeetCode → GitHub Auto-Sync

Automatically syncs your accepted LeetCode submissions to a GitHub repository. Polls LeetCode's GraphQL API for new accepted submissions, then pushes each one as a file to GitHub — no manual copy-pasting required.

## How it works

1. **Poll** — checks your recent accepted submissions via LeetCode's (unofficial) GraphQL API.
2. **Dedup** — compares against a local `synced.json` file to skip anything already pushed.
3. **Fetch** — pulls the full submitted code for each new submission.
4. **Push** — commits the code to your GitHub repo via the Contents API, under `problem-slug/solution.ext`.
5. Repeats on an interval (default: every 5 minutes).

Submissions are only marked as synced *after* a successful GitHub push — if a push fails, it's retried automatically (exponential backoff) and, failing that, retried again on the next poll instead of being silently skipped.

## Project structure

| File | Purpose |
|---|---|
| `leetcodeClient.js` | Shared LeetCode GraphQL client — fetch recent submissions & submission details |
| `pushToGithub.js` | Pushes a given solution's code to GitHub via the Contents API |
| `withRetry.js` | Retry helper with exponential backoff + jitter for flaky network/API calls |
| `poll.js` | Main entry point — polling loop, dedup logic, status/alerting |
| `fetchSubmissions.js` | Standalone script to list recent accepted submissions |
| `getSubmissionDetails.js` | Standalone script to fetch one submission's full code |
| `testPushOne.js` | Manual test: fetch one submission and push it to GitHub |

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Get your LeetCode session cookies
1. Log into [leetcode.com](https://leetcode.com) in your browser.
2. Open DevTools → Application → Cookies → `https://leetcode.com`.
3. Copy the values of `LEETCODE_SESSION` and `csrftoken`.

⚠️ `LEETCODE_SESSION` expires periodically — when it does, the poller will detect the failure, stop hammering the API, and log a clear message telling you to refresh it.

### 3. Create a GitHub Personal Access Token
Fine-grained PAT, scoped to just your target repo, with **Contents: Read and write** permission. Avoid "no expiration" — set a expiry (e.g. 1 year).

### 4. Configure environment variables
Create a `.env` file in the project root:
```
LEETCODE_SESSION=your_session_cookie
LEETCODE_CSRF=your_csrf_token
LEETCODE_USERNAME=your_leetcode_username

GITHUB_TOKEN=your_github_pat
GITHUB_REPO_OWNER=your_github_username
GITHUB_REPO_NAME=your_solutions_repo
```

### 5. Run it
```bash
node poll.js
```
Leave it running — it checks immediately on start, then every 5 minutes after.

## Running continuously

Use [PM2](https://pm2.keymetrics.io/) to keep it running in the background:
```bash
npm install -g pm2
pm2 start poll.js --name leetcode-sync
pm2 save
```

After a reboot (PM2 doesn't auto-start on Windows without extra setup):
```bash
pm2 resurrect
```

## Notes

- Dedup state lives in `synced.json` (auto-created, gitignored) — delete it if you ever want to force a full re-sync.
- Status of the last poll (success/failure) is written to `status.json` for easy inspection or future alerting hooks.
- Language-to-file-extension mapping lives in `pushToGithub.js` — extend `EXTENSION_MAP` if you code in a language not already listed.

## Possible next steps

- Swap `synced.json` for a real DB if deploying somewhere with an ephemeral filesystem.
- Decouple polling from pushing with a queue (e.g. Redis/BullMQ) for better failure isolation.
- Deploy as a GitHub Actions scheduled workflow instead of a long-running process, for a free always-on setup.
