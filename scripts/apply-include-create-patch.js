#!/usr/bin/env node
/**
 * Teach @mcp-abap-adt/adt-clients how to create report includes (PROG/I).
 *
 * Upstream (checked 10.1.0) core/program/create.js maps program_type
 * "include" to program:programType="I", but always POSTs a
 * <program:abapProgram> document to /sap/bc/adt/programs/programs. SAP ignores
 * the type on that collection and creates an executable report (type 1), so
 * CreateProgram with program_type "include" silently yields a PROG/P that no
 * other program can INCLUDE.
 *
 * Includes have their own collection. The ADT discovery document lists
 *
 *   /sap/bc/adt/programs/includes
 *     accept: application/vnd.sap.adt.programs.includes.v2+xml
 *
 * and expects an <include:abapInclude> document of type PROG/I.
 *
 * One edit: create() hands type "I" to a new createInclude() that posts that
 * document to the include collection. Every other program type keeps the
 * upstream code path untouched.
 *
 * Follows apply-include-activation-patch.js: resolve via require.resolve
 * (survives npm hoisting), idempotent, and never fails the install - on any
 * surprise it warns and exits 0, leaving include creation as broken as it was.
 */

const fs = require('node:fs');
const path = require('node:path');

const MARKER = 'MCP-ADT-INCLUDE-CREATE';

const ANCHOR = '    const programType = convertProgramType(args.programType);';

const REPLACEMENT = [
  ANCHOR,
  `    // ${MARKER}: includes are created in their own ADT collection.`,
  "    if (programType === 'I') {",
  '        return createInclude(connection, args, description);',
  '    }',
].join('\n');

const APPENDIX = `
// ${MARKER}: POST an <include:abapInclude> to /sap/bc/adt/programs/includes.
// The programs collection ignores programType="I" and creates a type 1 report.
function createInclude(connection, args, description) {
    const ct = 'application/vnd.sap.adt.programs.includes.v2+xml';
    const xmlAttr = (value) => String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/"/g, '&quot;');
    const lang = args.masterLanguage || 'EN';
    const masterSystemAttr = args.masterSystem
        ? \` adtcore:masterSystem="\${xmlAttr(args.masterSystem)}"\`
        : '';
    const responsibleAttr = args.responsible
        ? \` adtcore:responsible="\${xmlAttr(args.responsible)}"\`
        : '';
    const url = \`/sap/bc/adt/programs/includes\${args.transportRequest ? \`?corrNr=\${args.transportRequest}\` : ''}\`;
    const metadataXml = \`<?xml version="1.0" encoding="UTF-8"?><include:abapInclude xmlns:include="http://www.sap.com/adt/programs/includes" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="\${xmlAttr(description)}" adtcore:language="\${lang}" adtcore:name="\${xmlAttr(args.programName)}" adtcore:type="PROG/I" adtcore:masterLanguage="\${lang}"\${masterSystemAttr}\${responsibleAttr}>
  <adtcore:packageRef adtcore:name="\${xmlAttr(args.packageName)}"/>
</include:abapInclude>\`;
    return connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: metadataXml,
        headers: { Accept: ct, 'Content-Type': ct },
    });
}
`;

function warn(message) {
  console.warn(`[include-create] ${message}`);
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

  const target = path.join(distDir, 'core', 'program', 'create.js');
  if (!fs.existsSync(target)) {
    warn(`${target} not found; include creation left unpatched.`);
    return;
  }

  const source = fs.readFileSync(target, 'utf8');
  if (source.includes(MARKER)) {
    return; // installs are idempotent
  }

  if (!source.includes(ANCHOR) || !source.includes('timeouts_1')) {
    warn(
      'create() no longer matches the expected shape - upstream may have ' +
        'changed. CreateProgram with program_type "include" will keep ' +
        'creating executables until this script is updated.',
    );
    return;
  }

  try {
    fs.writeFileSync(target, source.replace(ANCHOR, REPLACEMENT) + APPENDIX);
    console.log('[include-create] enabled creation of PROG/I includes.');
  } catch (error) {
    warn(`could not write ${target}: ${error.message}`);
  }
}

main();
