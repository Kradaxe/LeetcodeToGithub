# LeetCode → GitHub Auto-Sync

A small background tool that keeps my GitHub contribution graph honest — it checks once a day whether I've already pushed something, and if I haven't, it goes and grabs my recent LeetCode solutions and pushes them for me.

## Why

I solve LeetCode problems most days but don't always remember to commit them anywhere. This closes that gap without me having to think about it.

## How it works

Once a day, at a fixed time (11:30 PM local):

1. **Check if today's already covered** — looks at my GitHub repo for any commit made today. If there's already one (manual or automated), it does nothing and waits for tomorrow.
2. **If not** — pulls my accepted LeetCode submissions (paginated, not limited to the last 10), filters out anything already synced, and pushes a portion of the backlog (20% per run, so a big backlog doesn't dump 40 files into one commit burst).
3. **Push** — each solution gets committed to `<problem-slug>/solution.<ext>` in the target repo, using the language extension pulled from the submission itself.
4. **Retry on failure** — network hiccups or rate limits get retried with backoff. A submission only gets marked as synced after it's actually landed on GitHub, so nothing silently falls through the cracks — it just gets picked up again the next non-green day.
5. **Fails loud, not silent** — if my LeetCode session cookie expires, it stops hammering the API and writes a clear status instead of retrying forever.

## Stack

Node.js, LeetCode's (unofficial, undocumented) GraphQL API, GitHub's REST Contents API.

## Setup

1. `npm install`
2. Grab `LEETCODE_SESSION` and `csrftoken` from your browser cookies (DevTools → Application → Cookies, while logged into leetcode.com)
3. Create a fine-grained GitHub PAT scoped to just your target repo, `Contents: Read and write`
4. Drop everything into a `.env`:
   ```
   LEETCODE_SESSION=...
   LEETCODE_CSRF=...
   LEETCODE_USERNAME=...
   GITHUB_TOKEN=...
   GITHUB_REPO_OWNER=...
   GITHUB_REPO_NAME=...
   ```
5. `node poll.js` and leave it running (I use PM2 to keep it alive locally)

## Known limitations

- LeetCode session cookies expire periodically — there's no official refresh flow, so this needs a manual cookie refresh every so often.
- Runs locally right now, so it only works while my machine's on. A GitHub Actions cron version is the natural next step if I want true 24/7 coverage without relying on my own uptime.
- Built against LeetCode's undocumented GraphQL API, so it can break if they change it — no SLA on that front, it's not an official API.

## What I'd build next

- Move it to GitHub Actions (free, doesn't depend on my laptop being on)
- Swap the local JSON dedup file for something more durable if deployed somewhere with an ephemeral filesystem
