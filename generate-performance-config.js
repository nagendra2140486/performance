const fs = require('fs');
const APP_CONFIG = require('./app-config');

const payload = JSON.parse(
  fs.readFileSync('payload.json', 'utf8')
);

const app = APP_CONFIG[payload.appname];

if (!app) {
  throw new Error(
    `Unsupported application: ${payload.appname}`
  );
}

const config = {
  appname: payload.appname,

  repo: app.repo,

  branch: app.branch,

  perfScript: app.perfScript,

  reportScript: app.reportScript,

  prId: payload.pr_id || '',

  generatedAt:
    payload.generated_at ||
    new Date().toISOString()
};

fs.writeFileSync(
  'performance-config.json',
  JSON.stringify(
    config,
    null,
    2
  )
);

console.log(
  'performance-config.json generated'
);

console.log(
  JSON.stringify(
    config,
    null,
    2
  )
);
