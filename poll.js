require('dotenv').config();
const fs = require('fs');
const path = require('path');

const { getAllAcceptedSubmissions, getSubmissionDetails } = require('./leetcodeClient');
const { pushSolution, hasCommitToday } = require('./pushToGithub');
const { withRetry } = require('./withRetry');

// Don't waste retries on errors that won't fix themselves (auth expired, bad request, etc.)
function isRetryable(err) {
  if (err.status === 401 || err.status === 403 || err.status === 404) return false;
  return true; // network errors, 5xx, rate limits (429) etc. are worth retrying
}

const SYNCED_FILE = path.join(__dirname, 'synced.json');
const STATUS_FILE = path.join(__dirname, 'status.json');

// Runs once daily at this local time.
const CHECK_HOUR = 23;
const CHECK_MINUTE = 30;

// Fraction of the backlog to push per run (e.g. 0.2 = 20%).
const PUSH_FRACTION = 0.2;

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

  try {
    const alreadyGreen = await withRetry(() => hasCommitToday(), { shouldRetry: isRetryable });
    if (alreadyGreen) {
      console.log('Already have a commit today — nothing to do.');
      writeStatus({ ok: true, skipped: 'already have a commit today' });
      return;
    }
  } catch (err) {
    console.error('Failed to check today\'s commits, proceeding with sync anyway:', err.message);
  }

  const syncedIds = loadSyncedIds();
  let recent;
  try {
    recent = await withRetry(() => getAllAcceptedSubmissions(100), { shouldRetry: isRetryable });
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

  // Only push a slice of the backlog per run (default 20%), so a big backlog
  // doesn't dump everything in one commit burst — always push at least 1.
  const chunkSize = Math.max(1, Math.ceil(newOnes.length * PUSH_FRACTION));
  const toPush = newOnes.slice(0, chunkSize);

  console.log(`Found ${newOnes.length} new submission(s) — pushing ${toPush.length} this run.`);

  for (const submission of toPush) {
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

function msUntilNextCheckTime() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(CHECK_HOUR, CHECK_MINUTE, 0, 0);

  if (next <= now) {
    next.setDate(next.getDate() + 1); // today's slot already passed, aim for tomorrow
  }

  return next - now;
}

function scheduleNextRun() {
  const delay = msUntilNextCheckTime();
  const runAt = new Date(Date.now() + delay);
  console.log(`Next check scheduled for ${runAt.toLocaleString()}`);

  setTimeout(async () => {
    await pollOnce();
    scheduleNextRun(); // reschedule for the same time tomorrow
  }, delay);
}

scheduleNextRun();