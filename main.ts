// SOLMARA HEAT — the entrypoint for make.fun gta6-01 (variant 2).
// This program hands the game in: it copies the game/ folder and the
// screenshots/ folder from next to this file into the output directory and
// writes the dossier.json the judge reads, using the vendored make.fun
// library. It runs on Node 22 with only the standard library, twice, and
// both runs must write identical bytes.
//
// Local run:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// In the grader the output directory is /output.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fresh output directory, then the two folders that make up the entry.
mkdirSync(outDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

// The dossier, built by the kit library from exactly what was copied, with
// the scorer's caps: 160 KiB of source text, at most 4 screenshots of at
// most 256 KiB each, game/ at most 993 entries and 48 MiB in all.
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
