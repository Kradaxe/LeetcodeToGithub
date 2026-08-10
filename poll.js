require('dotenv').config();
const fs = require('fs');
const path = require('path');

const { getRecentAcSubmissions, getSubmissionDetails } = require('./leetcodeClient');
const { pushSolution } = require('./pushToGithub');
const { withRetry } = require('./withRetry');

// Don't waste retries on errors that won't fix themselves (auth expired, bad request, etc.)
function isRetryable(err) {
  if (err.status === 401 || err.status === 403 || err.status === 404) return false;
  return true; // network errors, 5xx, rate limits (429) etc. are worth retrying
}

const SYNCED_FILE = path.join(__dirname, 'synced.json');
const STATUS_FILE = path.join(__dirname, 'status.json');
const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Once we know LeetCode auth is dead, stop hammering it every poll — just
// remind the user loudly instead, until they restart with fresh cookies.
let authIsDead = false;

function writeStatus(status) {
  fs.writeFileSync(STATUS_FILE, JSON.stringify({ ...status, updatedAt: new Date().toISOString() }, null, 2));
}

function loadSyncedIds() {
  if (!fs.existsSync(SYNCED_FILE)) return new Set();
  const raw = fs.readFileSync(SYNCED_FILE, 'utf-8');
  try {
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

function saveSyncedIds(idsSet) {
  fs.writeFileSync(SYNCED_FILE, JSON.stringify([...idsSet], null, 2));
}

async function pollOnce() {
  if (authIsDead) {
    console.error(
      `[${new Date().toLocaleString()}] ⚠️  SKIPPING POLL — LeetCode session is expired. ` +
        `Refresh LEETCODE_SESSION and csrftoken in .env, then restart the script.`
    );
    return;
  }

  console.log(`[${new Date().toLocaleString()}] Polling for new submissions...`);

  const syncedIds = loadSyncedIds();
  let recent;
  try {
    recent = await withRetry(() => getRecentAcSubmissions(20), { shouldRetry: isRetryable });
  } catch (err) {
    if (err.status === 401 || err.status === 403) {
      authIsDead = true;
      writeStatus({ ok: false, reason: 'LeetCode session expired', detail: err.message });
      console.error(`\n🚨 LeetCode session expired. Sync is paused until you refresh your cookies.\n`);
      return;
    }
    throw err; // unexpected error type — let it surface normally
  }

  writeStatus({ ok: true });

  const newOnes = recent.filter((s) => !syncedIds.has(s.id));

  if (newOnes.length === 0) {
    console.log('No new submissions.');
    return;
  }

  console.log(`Found ${newOnes.length} new submission(s).`);

  for (const submission of newOnes) {
    try {
      const details = await withRetry(() => getSubmissionDetails(submission.id), {
        shouldRetry: isRetryable,
      });

      await withRetry(
        () =>
          pushSolution({
            titleSlug: details.question.titleSlug,
            langKey: details.lang.name,
            code: details.code,
            commitMessage: `Sync: ${details.question.title}`,
          }),
        { shouldRetry: isRetryable }
      );

      // Only mark as synced AFTER a successful push
      syncedIds.add(submission.id);
      saveSyncedIds(syncedIds);
    } catch (err) {
      console.error(`Failed to sync submission ${submission.id} (${submission.title}):`, err.message);
      // Don't add to syncedIds — will retry on next poll
    }
  }
}

async function startPolling() {
  await pollOnce(); // run once immediately on startup
  setInterval(pollOnce, POLL_INTERVAL_MS);
}

startPolling().catch((err) => console.error('Fatal error in polling loop:', err));