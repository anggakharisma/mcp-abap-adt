#!/usr/bin/env node
/**
 * Send CreateTransport's target_system to SAP as given.
 *
 * Upstream (checked 10.1.0) core/transport/create.js builds
 *
 *   tm:target="/${args.target_system}/"
 *
 * In TMS, /NAME/ is a target group, so a real target system such as Q01 is
 * rejected with "Target '/Q01/' does not exist", and the only target that
 * works is the LOCAL fallback - a request that can never be imported
 * anywhere. A plain tm:target="Q01" creates the request with TARSYSTEM Q01
 * (verified on ABL D01, request D01K904391). Callers that really mean a
 * target group can still pass "/GROUP/".
 *
 * Follows apply-include-create-patch.js: resolve via require.resolve
 * (survives npm hoisting), idempotent, and never fails the install - on any
 * surprise it warns and exits 0, leaving the target handling as it was.
 */

const fs = require('node:fs');
const path = require('node:path');

const MARKER = 'MCP-ADT-TRANSPORT-TARGET';

const ANCHOR = '        ? `/${args.target_system}/`';

const REPLACEMENT = `        ? args.target_system.trim() // ${MARKER}: /X/ is a target group in TMS`;

function warn(message) {
  console.warn(`[transport-target] ${message}`);
}

function main() {
  let distDir;
  try {
    // adt-clients' "exports" map hides ./package.json; resolve the entry
    // (dist/index.js) and take its directory as the dist root.
    const entry = require.resolve('@mcp-abap-adt/adt-clients', {
      paths: [__dirname, process.cwd()],
    });
    distDir = path.dirname(entry);
  } catch {
    warn('@mcp-abap-adt/adt-clients not installed; nothing to do.');
    return;
  }

  const target = path.join(distDir, 'core', 'transport', 'create.js');
  if (!fs.existsSync(target)) {
    warn(`${target} not found; transport target left unpatched.`);
    return;
  }

  const source = fs.readFileSync(target, 'utf8');
  if (source.includes(MARKER)) {
    return; // installs are idempotent
  }

  if (!source.includes(ANCHOR)) {
    warn(
      'buildCreateTransportXml() no longer matches the expected shape - ' +
        'upstream may have changed. CreateTransport with a target_system ' +
        'may keep failing until this script is updated.',
    );
    return;
  }

  try {
    fs.writeFileSync(target, source.replace(ANCHOR, REPLACEMENT));
    console.log('[transport-target] CreateTransport sends target_system as given.');
  } catch (error) {
    warn(`could not write ${target}: ${error.message}`);
  }
}

main();
