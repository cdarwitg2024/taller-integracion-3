'use strict';

// Treat the downloaded artifact as data, never as shell commands or code.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const release = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
assert.match(process.env.GITHUB_SHA || '', /^[a-f0-9]{40}$/);
assert.equal(release.sha, process.env.GITHUB_SHA, 'Release commit mismatch');
const services = ['ms-cafeterias', 'ms-menus', 'ms-pedidos'];
assert.deepEqual(Object.keys(release.images).sort(), [...services].sort());
for (const service of services) {
  assert.match(release.images[service], new RegExp(
    '^cdarwitg2024/' + service + '@sha256:[a-f0-9]{64}$'
  ), 'Unexpected registry, service or digest');
}
console.log('Release validated for commit ' + release.sha);
