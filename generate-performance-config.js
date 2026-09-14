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

  // payload.api_url lets a specific run point at a different environment
  // (e.g. a per-PR preview URL) without editing app-config.js.
  apiUrl:
    payload.api_url ||
    app.apiUrl ||
    '',

  perfScript: app.perfScript,

  reportScript: app.reportScript,

  prId: payload.pr_id || '',

  generatedAt:
    payload.generated_at ||
    new Date().toISOString()
};

if (!config.apiUrl) {
  console.warn(
    `Warning: no apiUrl configured for '${payload.appname}'. ` +
    `The performance test will fall back to its script's localhost default.`
  );
}

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
