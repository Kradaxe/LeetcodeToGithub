require('dotenv').config();
const fetch = require('node-fetch');

const LEETCODE_SESSION = process.env.LEETCODE_SESSION;
const CSRF_TOKEN = process.env.LEETCODE_CSRF;
const LEETCODE_USERNAME = process.env.LEETCODE_USERNAME;

async function leetcodeGraphQL(query, variables) {
  const res = await fetch('https://leetcode.com/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `LEETCODE_SESSION=${LEETCODE_SESSION}; csrftoken=${CSRF_TOKEN}`,
      'x-csrftoken': CSRF_TOKEN,
      'Referer': 'https://leetcode.com',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (res.status === 401 || res.status === 403) {
    const err = new Error('LeetCode session expired or invalid (401/403). Refresh LEETCODE_SESSION and csrftoken.');
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  if (data.errors) {
    const err = new Error(`LeetCode GraphQL error: ${JSON.stringify(data.errors)}`);
    err.status = res.status;
    throw err;
  }
  return data.data;
}

async function getRecentAcSubmissions(limit = 20) {
  const query = `
    query recentAcSubmissions($username: String!, $limit: Int!) {
      recentAcSubmissionList(username: $username, limit: $limit) {
        id
        title
        titleSlug
        timestamp
        lang
      }
    }
  `;
  const data = await leetcodeGraphQL(query, { username: LEETCODE_USERNAME, limit });
  return data.recentAcSubmissionList;
}

async function getSubmissionDetails(submissionId) {
  const query = `
    query submissionDetails($submissionId: Int!) {
      submissionDetails(submissionId: $submissionId) {
        runtime
        runtimePercentile
        memory
        memoryPercentile
        code
        lang { name verboseName }
        question { questionId titleSlug title }
      }
    }
  `;
  const data = await leetcodeGraphQL(query, { submissionId: Number(submissionId) });
  return data.submissionDetails;
}

// recentAcSubmissionList is hard-capped at 10 by LeetCode regardless of the
// limit passed in. To see further back, we page through the full submission
// history via submissionList (offset + lastKey cursor) and filter to accepted
// ones ourselves, since the `status` filter enum isn't reliably documented.
async function getAllAcceptedSubmissions(maxCount = 100) {
  const query = `
    query submissionList($offset: Int!, $limit: Int!, $lastKey: String) {
      submissionList(offset: $offset, limit: $limit, lastKey: $lastKey) {
        lastKey
        hasNext
        submissions {
          id
          title
          titleSlug
          statusDisplay
          lang
          timestamp
        }
      }
    }
  `;

  const accepted = [];
  let offset = 0;
  let lastKey = null;
  const PAGE_SIZE = 20;
  const MAX_PAGES = 50; // hard safety cap so a bug can't loop forever

  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await leetcodeGraphQL(query, { offset, limit: PAGE_SIZE, lastKey });
    const { submissions, hasNext, lastKey: nextKey } = data.submissionList;

    for (const s of submissions) {
      if (s.statusDisplay === 'Accepted') accepted.push(s);
      if (accepted.length >= maxCount) return accepted;
    }

    if (!hasNext || submissions.length === 0) break;
    offset += PAGE_SIZE;
    lastKey = nextKey;
  }

  return accepted;
}

module.exports = { getRecentAcSubmissions, getSubmissionDetails, getAllAcceptedSubmissions };