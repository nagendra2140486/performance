const fs = require('fs');
const { execSync } = require('child_process');
const APP_CONFIG = require('./app-config');

const payload = JSON.parse(
  fs.readFileSync('payload.json', 'utf8')
);

const app = APP_CONFIG[payload.appname];

if (!app) {
  throw new Error(
    `Application '${payload.appname}' is not configured in app-config.js`
  );
}

console.log(`Application: ${payload.appname}`);
console.log(`Repository: ${app.repo}`);
console.log(`Branch: ${app.branch || 'main'}`);

try {
  execSync(
    `git clone --branch ${app.branch || 'main'} ${app.repo} app`,
    {
      stdio: 'inherit',
      shell: true
    }
  );

  console.log('Repository cloned successfully');
} catch (err) {
  console.error('Clone failed');
  console.error(err.message);
  process.exit(1);
}
