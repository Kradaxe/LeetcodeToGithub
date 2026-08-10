require('dotenv').config();
const fetch = require('node-fetch');

const LEETCODE_SESSION = process.env.LEETCODE_SESSION;
const CSRF_TOKEN = process.env.LEETCODE_CSRF;

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

async function main() {
  const username = process.env.LEETCODE_USERNAME; // your leetcode username

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
      variables: { username, limit: 20 },
    }),
  });

  const data = await res.json();

  if (data.errors) {
    console.error('GraphQL errors:', data.errors);
    return;
  }

  const submissions = data.data.recentAcSubmissionList;
  submissions.forEach((s) => {
    const date = new Date(s.timestamp * 1000).toLocaleString();
    console.log(`[${date}] ${s.title} (${s.lang}) - id: ${s.id}`);
  });
}

main().catch((err) => console.error('Error fetching submissions:', err));
