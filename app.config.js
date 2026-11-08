// Adds to app.json. The browser version on epgog.com lives under /app, so its build sets
// EXPO_WEB_BASE_URL=/app (see .github/workflows/epg.yml). Phone builds and updates leave it unset.
module.exports = ({ config }) =>
  process.env.EXPO_WEB_BASE_URL ? { ...config, experiments: { ...config.experiments, baseUrl: process.env.EXPO_WEB_BASE_URL } } : config;
