const fs = require('fs');

/*
 * Read payload
 */
const payload = JSON.parse(
  fs.readFileSync('payload.json', 'utf8')
);

/*
 * Read raw k6 report
 */
const report = JSON.parse(
  fs.readFileSync('performance-report.json', 'utf8')
);

const metrics = report.metrics || {};

/*
 * Turn a metric name into a readable journey name, e.g.
 * "journey_export_pdf_ms" -> "Export PDF", "journey_auth_ms" -> "Auth".
 * A handful of acronyms are kept upper-case; everything else is title-cased.
 */
const ACRONYMS = new Set(['ai', 'csv', 'pdf', 'api', 'id']);

const toJourneyName = (metricName) =>
  metricName
    .replace(/^journey_/, '')
    .replace(/_ms$/, '')
    .split('_')
    .map((word) =>
      ACRONYMS.has(word)
        ? word.toUpperCase()
        : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(' ');

/*
 * A k6 threshold key looks like "p(95)<400" — pull the numeric budget out of it.
 * Falls back to null (no target) if the key doesn't parse, so a journey with an
 * unusual/missing threshold still gets reported instead of silently dropped.
 */
const parseTargetMs = (thresholdKey) => {
  const match = thresholdKey.match(/<\s*(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
};

/*
 * Discover every "journey_*_ms" metric this app's k6 script defined — no hardcoded
 * list, so any app's critical-journeys.js works here unchanged.
 */
const journeyMetricNames = Object.keys(metrics)
  .filter((name) => /^journey_.+_ms$/.test(name))
  .sort();

const journeys = [];
const thresholdFailures = [];

for (const metricName of journeyMetricNames) {
  const metric = metrics[metricName];

  if (metric.avg === undefined) {
    continue;
  }

  const avg = Number(metric.avg.toFixed(2));
  const p95 = Number((metric['p(95)'] || 0).toFixed(2));
  const name = toJourneyName(metricName);

  const thresholdEntries = Object.entries(metric.thresholds || {});
  // k6 threshold values are "was this threshold BREACHED?" — true means failed.
  const breached = thresholdEntries.some(([, isBreached]) => isBreached === true);
  const target = thresholdEntries.length ? parseTargetMs(thresholdEntries[0][0]) : null;

  journeys.push({
    name,
    metric: metricName,
    avg_ms: avg,
    p95_ms: p95,
    target_ms: target,
    status: breached ? 'failed' : 'passed'
  });

  if (breached) {
    thresholdFailures.push({
      journey: name,
      observed: `P95 = ${p95} ms`,
      expected: target !== null ? `P95 < ${target} ms` : 'within configured threshold',
      reason: `${name} exceeded its response-time threshold and may impact user experience.`
    });
  }
}

/*
 * Functional (non-perf) failures: any check that failed at least once, wherever it
 * sits in the group tree. A slow journey and a broken endpoint are different kinds of
 * problems, so these are kept separate from thresholdFailures rather than merged in.
 */
const checkFailures = [];

const walkGroups = (group, groupPath) => {
  for (const [checkName, check] of Object.entries(group.checks || {})) {
    if (check.fails > 0) {
      checkFailures.push({
        group: groupPath,
        check: checkName,
        passes: check.passes,
        fails: check.fails
      });
    }
  }

  for (const [childName, childGroup] of Object.entries(group.groups || {})) {
    walkGroups(childGroup, groupPath ? `${groupPath} > ${childName}` : childName);
  }
};

walkGroups(report.root_group || {}, '');

const totalRequests = metrics.http_reqs?.count || 0;
const checksPassed = metrics.checks?.passes || 0;
const checksFailed = metrics.checks?.fails || 0;

// Failed if ANY threshold was breached OR any check failed — checksFailed is the raw
// signal from k6 itself and must gate the status independently of the journey list,
// otherwise a metric-name mismatch (or a check with no matching journey metric) could
// silently produce a false "passed" the way it did before this fix.
const overallStatus =
  thresholdFailures.length > 0 || checkFailures.length > 0 || checksFailed > 0
    ? 'failed'
    : 'passed';

/*
 * Analysis JSON
 */
const analysisJson = {
  stage: 'performance',
  pr_id: payload.pr_id || '',
  runner: 'k6',
  overall: {
    requests: totalRequests,
    checks_passed: checksPassed,
    checks_failed: checksFailed,
    status: overallStatus
  },
  journeys,
  threshold_failures: thresholdFailures,
  check_failures: checkFailures,
  // Kept for backward compatibility with anything reading `failures` from earlier reports.
  failures: thresholdFailures
};

/*
 * Markdown sections
 */
const journeyTable = journeys.length
  ? journeys
      .map((j) => `| ${j.name} | ${j.avg_ms} | ${j.p95_ms} | ${j.target_ms ?? '—'} | ${j.status} |`)
      .join('\n')
  : '| _no journey_*_ms metrics found in this run_ | | | | |';

const thresholdFindings = thresholdFailures.length
  ? thresholdFailures
      .map(
        (f) => `
### ${f.journey} (threshold)

Observed:
- ${f.observed}

Expected:
- ${f.expected}

Reason:
${f.reason}
`
      )
      .join('\n')
  : '';

const checkFindings = checkFailures.length
  ? `
### Failed checks

| Group | Check | Passes | Fails |
| --- | --- | ---: | ---: |
${checkFailures.map((c) => `| ${c.group || '—'} | ${c.check} | ${c.passes} | ${c.fails} |`).join('\n')}
`
  : '';

const findings =
  thresholdFindings || checkFindings
    ? `${thresholdFindings}${checkFindings}`
    : '\nNo performance threshold violations or check failures were detected.\n';

const analysisMarkdown = `
# Performance Execution — ${payload.appname} PR #${payload.pr_id || 'N/A'}

## Overall Summary

Performance testing completed.

| Metric | Value |
| --- | --- |
| Requests | ${totalRequests} |
| Passed Checks | ${checksPassed} |
| Failed Checks | ${checksFailed} |
| Status | ${overallStatus} |

## Journey Results

| Journey | Avg (ms) | P95 (ms) | Target (ms) | Status |
| --- | ---: | ---: | ---: | --- |
${journeyTable}

## Performance Findings

${findings}

## Conclusion

${
  overallStatus === 'failed'
    ? 'One or more performance thresholds or functional checks failed and require investigation.'
    : 'All tested journeys completed within acceptable performance limits.'
}
`;

/*
 * Final PRQE report
 */
const performanceReport = {
  id: `${payload.appname}_performance-report_${payload.pr_id || Date.now()}`,
  appname: payload.appname,
  reporttype: 'performance-report',
  
  repository: payload.repository || '',
  pr_id: payload.pr_id || '',
  analysis_markdown: analysisMarkdown,
  analysis_json: analysisJson,
  created_at: payload.generated_at || new Date().toISOString()
};

fs.writeFileSync(
  'performance-analysis.json',
  JSON.stringify(performanceReport, null, 2)
);

console.log('performance-analysis.json generated successfully');
