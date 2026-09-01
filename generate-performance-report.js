const fs = require('fs');

/*
 * Read payload
 */
const payload = JSON.parse(
  fs.readFileSync(
    'payload.json',
    'utf8'
  )
);

/*
 * Read raw k6 report
 */
const report = JSON.parse(
  fs.readFileSync(
    'performance-report.json',
    'utf8'
  )
);

const metrics =
  report.metrics || {};

const getMetric = name =>
  metrics[name] || {};

/*
 * Journey definitions
 */
const journeyMap = [
  {
    name: 'Catalogue',
    metric: 'journey_catalogue_ms',
    target: 500
  },
  {
    name: 'Destination Detail',
    metric: 'journey_destination_detail_ms',
    target: 500
  },
  {
    name: 'Packages',
    metric: 'journey_packages_ms',
    target: 500
  },
  {
    name: 'Contact',
    metric: 'journey_contact_ms',
    target: 500
  },
  {
    name: 'AI Itinerary',
    metric: 'journey_ai_itinerary_ms',
    target: 1500
  },
  {
    name: 'AI Chat',
    metric: 'journey_ai_chat_ms',
    target: 1500
  },
  {
    name: 'AI Budget',
    metric: 'journey_ai_budget_ms',
    target: 1500
  },
  {
    name: 'Governance',
    metric: 'journey_governance_ms',
    target: 800
  },
  {
    name: 'Trips',
    metric: 'journey_trips_ms',
    target: 500
  }
];

/*
 * Analyze journeys
 */
const journeys = [];
const failures = [];

for (const journey of journeyMap) {

  const metric =
    getMetric(
      journey.metric
    );

  if (!metric.avg) {
    continue;
  }

  const avg =
    Number(
      metric.avg.toFixed(2)
    );

  const p95 =
    Number(
      (
        metric['p(95)'] ||
        0
      ).toFixed(2)
    );

  const passed =
    p95 <= journey.target;

  journeys.push({
    name: journey.name,
    avg_ms: avg,
    p95_ms: p95,
    target_ms: journey.target,
    status:
      passed
        ? 'passed'
        : 'failed'
  });

  if (!passed) {

    failures.push({
      journey:
        journey.name,

      observed:
        `P95 = ${p95} ms`,

      expected:
        `P95 < ${journey.target} ms`,

      reason:
        `${journey.name} exceeded the agreed response-time threshold and may impact user experience.`
    });

  }

}

const totalRequests =
  metrics.http_reqs?.count || 0;

const checksPassed =
  metrics.checks?.passes || 0;

const checksFailed =
  metrics.checks?.fails || 0;

const overallStatus =
  failures.length
    ? 'failed'
    : 'passed';

/*
 * Analysis JSON
 */
const analysisJson = {
  stage: 'performance',

  pr_id:
    payload.pr_id || '',

  runner: 'k6',

  overall: {
    requests:
      totalRequests,

    checks_passed:
      checksPassed,

    checks_failed:
      checksFailed,

    status:
      overallStatus
  },

  journeys,

  failures
};

/*
 * Markdown sections
 */
const journeyTable =
  journeys.map(
    j =>
      `| ${j.name} | ${j.avg_ms} | ${j.p95_ms} | ${j.status} |`
  )
  .join('\n');

const findings =
  failures.length
    ? failures
        .map(
          f =>
`
### ${f.journey}

Observed:
- ${f.observed}

Expected:
- ${f.expected}

Reason:
${f.reason}
`
        )
        .join('\n')
    : `
No performance threshold violations were detected.
`;

const analysisMarkdown = `
# Performance Execution — ${payload.appname} PR #${payload.pr_id || 'N/A'}

## Overall Summary

Performance testing completed.

| Metric | Value |
| --- | --- |
| Requests | ${totalRequests} |
| Passed Checks | ${checksPassed} |
| Failed Checks | ${checksFailed} |

## Journey Results

| Journey | Avg (ms) | P95 (ms) | Status |
| --- | ---: | ---: | --- |
${journeyTable}

## Performance Findings

${findings}

## Conclusion

${
  failures.length
    ? 'One or more performance thresholds were violated and require investigation.'
    : 'All tested journeys completed within acceptable performance limits.'
}
`;

/*
 * Final PRQE report
 */
const performanceReport = {
  id:
    `${payload.appname}_performance-report_${payload.pr_id || Date.now()}`,

  appname:
    payload.appname,

  reporttype:
    'performance-report',

  repository:
    payload.repository || '',

  pr_id:
    payload.pr_id || '',

  analysis_markdown:
    analysisMarkdown,

  analysis_json:
    analysisJson,

  created_at:
    payload.generated_at ||
    new Date().toISOString()
};

fs.writeFileSync(
  'performance-analysis.json',
  JSON.stringify(
    performanceReport,
    null,
    2
  )
);

console.log(
  'performance-analysis.json generated successfully'
);
