const fs = require('fs');

const report = JSON.parse(
  fs.readFileSync(
    'regression-report.json',
    'utf8'
  )
);

const content = `
# Functional Regression Test Result

## Application

${report.appname}

## Pull Request

${report.pr_id}

${report.analysis_markdown}

---

Generated automatically by PRQE
`;

const pat = process.env.ADO_PAT;

const auth =
  Buffer.from(`:${pat}`).toString('base64');

async function updateWiki() {

  const response = await fetch(
    'https://dev.azure.com/CRaaSOrg/voyagenie/_apis/wiki/wikis/voyagenie.wiki/pages?path=/Functional-Regression-Test-Result&api-version=7.1',
    {
      method: 'PUT',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content
      })
    }
  );

  const text =
    await response.text();

  console.log(
    'Wiki Update Status:',
    response.status
  );

  console.log(text);

  if (!response.ok) {
    process.exit(1);
  }

}

updateWiki().catch(err => {
  console.error(err);
  process.exit(1);
});
