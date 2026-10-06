/**
 * Update an ABAP program from a local file, byte-exact (no LLM transcription).
 * Usage: npx tsx scripts/apply-program-from-file.ts --env ./.env.abl \
 *   --program ZABLMM_F00002 --file <src.abap> --transport D01K... [--activate]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import * as dotenv from 'dotenv';
import { getSapConfigFromEnv } from '../src/__tests__/integration/helpers/configHelpers';
import { handleUpdateProgram } from '../src/handlers/program/high/handleUpdateProgram';
import { resolveSystemContext } from '../src/lib/systemContext';

async function main() {
  const args = process.argv.slice(2);
  const get = (f: string) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
  dotenv.config({ path: path.resolve(get('--env')!), override: true });
  const source = fs.readFileSync(path.resolve(get('--file')!), 'utf8');
  const connection: any = createAbapConnection(getSapConfigFromEnv());
  if (connection.connect) await connection.connect();
  await resolveSystemContext(connection);
  const logger = { info: () => {}, warn: (...a: any[]) => console.error('[warn]', ...a), error: (...a: any[]) => console.error('[error]', ...a), debug: () => {} };
  const res = await handleUpdateProgram({ connection, logger } as any, {
    program_name: get('--program')!,
    source_code: source,
    transport_request: get('--transport'),
    activate: args.includes('--activate'),
  });
  const text = res.content?.[0]?.text ?? '';
  console.log(res.isError ? '=== FAILED ===' : '=== OK ===');
  console.log(text.slice(0, 4000));
  if (res.isError) process.exit(2);
}
main().catch((e) => { console.error('Fatal:', e); process.exit(99); });
