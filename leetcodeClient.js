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

module.exports = { getRecentAcSubmissions, getSubmissionDetails };