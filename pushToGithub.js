require('dotenv').config();
const fetch = require('node-fetch');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = process.env.GITHUB_REPO_OWNER; // e.g. your github username
const REPO_NAME = process.env.GITHUB_REPO_NAME;   // e.g. leetcode-solutions

// Maps LeetCode's language name to a file extension
const EXTENSION_MAP = {
  python3: 'py',
  python: 'py',
  java: 'java',
  'c++': 'cpp',
  c: 'c',
  javascript: 'js',
  typescript: 'ts',
  golang: 'go',
  rust: 'rs',
  kotlin: 'kt',
  swift: 'swift',
  csharp: 'cs',
  ruby: 'rb',
  scala: 'scala',
  php: 'php',
};

function getExtension(langKey) {
  return EXTENSION_MAP[langKey?.toLowerCase()] || 'txt';
}

async function githubRequest(path, options = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(`GitHub API error: ${res.status} ${JSON.stringify(data)}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// Checks if a file already exists at `filePath`, returns its sha if so, else null
async function getExistingFileSha(filePath) {
  try {
    const data = await githubRequest(
      `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`
    );
    return data.sha;
  } catch (err) {
    if (err.status === 404) return null; // file doesn't exist yet
    throw err;
  }
}

async function pushSolution({ titleSlug, langKey, code, commitMessage }) {
  const ext = getExtension(langKey);
  const filePath = `${titleSlug}/solution.${ext}`;

  const existingSha = await getExistingFileSha(filePath);

  const body = {
    message: commitMessage || `Sync: ${titleSlug}`,
    content: Buffer.from(code, 'utf-8').toString('base64'),
    ...(existingSha ? { sha: existingSha } : {}),
  };

  const result = await githubRequest(
    `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`,
    {
      method: 'PUT',
      body: JSON.stringify(body),
    }
  );

  console.log(`Pushed ${filePath} -> commit ${result.commit.sha}`);
  return result;
}

// Returns true if there's already a commit today that the bot didn't make itself
// (i.e. a manual push) — used to skip auto-sync on days you pushed by hand.
async function hasManualCommitToday() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const sinceIso = startOfDay.toISOString();

  const commits = await githubRequest(
    `/repos/${REPO_OWNER}/${REPO_NAME}/commits?since=${encodeURIComponent(sinceIso)}&per_page=100`
  );

  return commits.some((c) => !c.commit.message.startsWith('Sync:'));
}

module.exports = { pushSolution, hasManualCommitToday };