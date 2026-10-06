/**
 * Dump ADT version sources byte-exact to disk.
 * Usage: npx tsx scripts/dump-versions.ts --env ./.env.abl --out <dir> <name>=<contentUri> ...
 * Use <name>=active:<PROGRAM> to dump the active source of a program.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import * as dotenv from 'dotenv';
import { getSapConfigFromEnv } from '../src/__tests__/integration/helpers/configHelpers';

async function main() {
  const args = process.argv.slice(2);
  const get = (f: string) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
  dotenv.config({ path: path.resolve(get('--env')!), override: true });
  const out = get('--out')!;
  fs.mkdirSync(out, { recursive: true });
  const conn: any = createAbapConnection(getSapConfigFromEnv());
  if (conn.connect) await conn.connect();
  for (const spec of args.filter((a) => a.includes('=') )) {
    const [name, uriRaw] = spec.split(/=(.*)/s);
    const uri = uriRaw.startsWith('incl:') ? `/sap/bc/adt/programs/includes/${uriRaw.slice(5)}/source/main` : uriRaw.startsWith('active:')
      ? `/sap/bc/adt/programs/programs/${uriRaw.slice(7)}/source/main`
      : uriRaw;
    const res = await conn.makeAdtRequest({ url: uri, method: 'GET', timeout: 60000, headers: { Accept: 'text/plain' } });
    const data = typeof res.data === 'string' ? res.data : String(res.data);
    fs.writeFileSync(path.join(out, name), data);
    console.log(`${name}: ${Buffer.byteLength(data)} bytes`);
  }
}
main().catch((e) => { console.error(e?.message || e); process.exit(1); });
