module.exports = {
  'voyagenie': {
    repo:
      'https://github.com/nagendra2140486/voyagenie.git',

    branch:
      'nagendra/functionaltests',

    // TODO: replace with Voyagenie's real deployed URL (currently supplied
    // out-of-band via the $(VOYAGENIE_API_URL) pipeline variable instead).
    apiUrl:
      'https://REPLACE_WITH_VOYAGENIE_LIVE_URL',

    perfScript:
      'perf/critical-journeys.js',

    reportScript:
      'perf/generate-performance-report.js'
  },

  'timesheet-app': {
    repo:
      'https://github.com/nagendra2140486/timesheet-app.git',

    branch:
      'main',

    apiUrl:
      'https://qea-timesheet-uat-ayfch9f0ehhwg6fp.canadacentral-01.azurewebsites.net',

    perfScript:
      'perf/critical-journeys.js',

    reportScript:
      'perf/generate-performance-report.js'
  }
};
