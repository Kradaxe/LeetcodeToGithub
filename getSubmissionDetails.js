require('dotenv').config();
const fetch = require('node-fetch');

const LEETCODE_SESSION = process.env.LEETCODE_SESSION;
const CSRF_TOKEN = process.env.LEETCODE_CSRF;

const query = `
  query submissionDetails($submissionId: Int!) {
    submissionDetails(submissionId: $submissionId) {
      runtime
      runtimePercentile
      memory
      memoryPercentile
      code
      lang {
        name
        verboseName
      }
      question {
        questionId
        titleSlug
        title
      }
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
    body: JSON.stringify({
      query,
      variables: { submissionId: Number(submissionId) },
    }),
  });

  const data = await res.json();

  if (data.errors) {
    console.error('GraphQL errors:', data.errors);
    return null;
  }

  return data.data.submissionDetails;
}

async function main() {
  // Pass a submission id as a command-line arg:
  // node getSubmissionDetails.js 1234567890
  const submissionId = process.argv[2];

  if (!submissionId) {
    console.error('Usage: node getSubmissionDetails.js <submissionId>');
    process.exit(1);
  }

  const details = await getSubmissionDetails(submissionId);

  if (!details) {
    console.error('No details found for that submission id.');
    return;
  }

  console.log('Problem:', details.question.title);
  console.log('Slug:', details.question.titleSlug);
  console.log('Language:', details.lang.name);
  console.log('Runtime:', details.runtime, `(better than ${details.runtimePercentile?.toFixed(2)}%)`);
  console.log('--- Code ---');
  console.log(details.code);
}

main().catch((err) => console.error('Error fetching submission details:', err));
