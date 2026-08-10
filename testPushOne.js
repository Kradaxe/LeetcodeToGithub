require('dotenv').config();
const { pushSolution } = require('./pushToGithub');

// Reuse the same query/fetch logic from getSubmissionDetails.js
const fetch = require('node-fetch');
const LEETCODE_SESSION = process.env.LEETCODE_SESSION;
const CSRF_TOKEN = process.env.LEETCODE_CSRF;

const query = `
  query submissionDetails($submissionId: Int!) {
    submissionDetails(submissionId: $submissionId) {
      code
      lang { name }
      question { titleSlug title }
    }
  }
`;

async function getSubmissionDetails(submissionId) {
  const res = await fetch('https://leetcode.com/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `LEETCODE_SESSION=${LEETCODE_SESSION}; csrftoken=${CSRF_TOKEN}`,
      'x-csrftoken': CSRF_TOKEN,
      'Referer': 'https://leetcode.com',
    },
    body: JSON.stringify({ query, variables: { submissionId: Number(submissionId) } }),
  });
  const data = await res.json();
  if (data.errors) throw new Error(JSON.stringify(data.errors));
  return data.data.submissionDetails;
}

async function main() {
  const submissionId = process.argv[2];
  if (!submissionId) {
    console.error('Usage: node testPushOne.js <submissionId>');
    process.exit(1);
  }

  const details = await getSubmissionDetails(submissionId);

  await pushSolution({
    titleSlug: details.question.titleSlug,
    langKey: details.lang.name,
    code: details.code,
    commitMessage: `Sync: ${details.question.title}`,
  });
}

main().catch((err) => console.error('Error:', err));
