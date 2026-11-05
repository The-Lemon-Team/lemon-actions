/**
 * Lemon Actions Test Reporter Hook Example
 * Example of how any Vitest/Jest/custom runner outputs test execution stats into .lemon/results.json
 */
const fs = require('fs');
const path = require('path');

function saveTestResults(resultsPayload) {
  const target = path.join(__dirname, '.lemon', 'results.json');
  fs.writeFileSync(target, JSON.stringify(resultsPayload, null, 2), 'utf-8');
  console.log(`[Lemon Reporter] Saved results for ${resultsPayload.results.length} tasks to ${target}`);
}

module.exports = { saveTestResults };
