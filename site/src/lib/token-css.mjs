// Plugin Vite: espone il modulo virtuale `virtual:token.css`, generato ad ogni build
// leggendo contracts/design-tokens.json. Nessun file CSS di token è committato (ADR-0002 D5).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const virtualModuleId = 'virtual:token.css';
// Deve terminare con .css: Vite riconosce i moduli CSS dall'estensione dell'id risolto,
// non dal prefisso \0, e li fa passare dalla pipeline CSS (quindi da lightningcss).
const resolvedVirtualModuleId = '\0virtual:token.css';

const tokensPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../contracts/design-tokens.json',
);

function isDataKey(key) {
  return !key.startsWith('_') && !key.startsWith('$');
}

function leggiToken() {
  const raw = readFileSync(tokensPath, 'utf8');
  return JSON.parse(raw);
}

// Riletto da site/src/lib/breakpoint-visitor.mjs (ADR-0004 punto 2): unico punto che apre
// contracts/design-tokens.json per i breakpoint, riusato invece di duplicare la lettura.
export function leggiBreakpointPx() {
  const tokens = leggiToken();
  const risultato = {};
  for (const [k, def] of Object.entries(tokens.breakpoint)) {
    if (!isDataKey(k)) continue;
    assertForma(def, `breakpoint.${k}`);
    const match = /^([0-9.]+)px$/.exec(String(def.value).trim());
    if (!match) {
      throw new Error(
        `token-css: breakpoint.${k} non è in px (letto: "${def.value}"); ` +
          `il visitor di Lightning CSS (ADR-0004) richiede breakpoint in px.`,
      );
    }
    risultato[k] = Number(match[1]);
  }
  return risultato;
}

function assertForma(def, contesto) {
  if (typeof def !== 'object' || def === null || !('value' in def)) {
    throw new Error(`token-css: forma non riconosciuta per ${contesto}`);
  }
}

function righeColore(aliasMap, contesto) {
  const righe = [];
  for (const [alias, def] of Object.entries(aliasMap)) {
    if (!isDataKey(alias)) continue;
    assertForma(def, `${contesto}.${alias}`);
    righe.push(`  --color-${alias}: ${def.value};`);
  }
  return righe;
}

export function generaTokenCss() {
  const tokens = leggiToken();

  const light = tokens.color.semantic.light;
  const dark = tokens.color.semantic.dark;
  const chiaviLight = Object.keys(light).filter(isDataKey).sort();
  const chiaviDark = Object.keys(dark).filter(isDataKey).sort();
  if (JSON.stringify(chiaviLight) !== JSON.stringify(chiaviDark)) {
    const soloLight = chiaviLight.filter((k) => !chiaviDark.includes(k));
    const soloDark = chiaviDark.filter((k) => !chiaviLight.includes(k));
    throw new Error(
      `token-css: color.semantic.light e color.semantic.dark hanno alias diversi. ` +
        `Solo in light: [${soloLight.join(', ')}]. Solo in dark: [${soloDark.join(', ')}].`,
    );
  }

  const root = [':root {', '  color-scheme: light dark;', ...righeColore(light, 'color.semantic.light')];

  assertForma(tokens.typography['font-family-base'], 'typography.font-family-base');
  root.push(`  --font-family-base: ${tokens.typography['font-family-base'].value};`);
  for (const gruppo of ['font-size', 'line-height', 'font-weight']) {
    for (const [k, def] of Object.entries(tokens.typography[gruppo])) {
      if (!isDataKey(k)) continue;
      assertForma(def, `typography.${gruppo}.${k}`);
      root.push(`  --${gruppo}-${k}: ${def.value};`);
    }
  }

  for (const [k, def] of Object.entries(tokens.spacing)) {
    if (!isDataKey(k)) continue;
    assertForma(def, `spacing.${k}`);
    root.push(`  --spacing-${k}: ${def.value};`);
  }
  for (const [k, def] of Object.entries(tokens.radius)) {
    if (!isDataKey(k)) continue;
    assertForma(def, `radius.${k}`);
    root.push(`  --radius-${k}: ${def.value};`);
  }
  assertForma(tokens.border.width, 'border.width');
  root.push(`  --border-width: ${tokens.border.width.value};`);
  for (const [k, def] of Object.entries(tokens['touch-target'])) {
    if (!isDataKey(k)) continue;
    assertForma(def, `touch-target.${k}`);
    root.push(`  --touch-target-${k}: ${def.value};`);
  }
  for (const [k, def] of Object.entries(tokens.focus)) {
    if (!isDataKey(k)) continue;
    assertForma(def, `focus.${k}`);
    root.push(`  --focus-${k}: ${def.value};`);
  }

  for (const [k, def] of Object.entries(tokens.breakpoint)) {
    if (!isDataKey(k)) continue;
    assertForma(def, `breakpoint.${k}`);
    root.push(`  --breakpoint-${k}: ${def.value};`);
  }
  root.push('}');

  const scuro = ['@media (prefers-color-scheme: dark) {', ':root {', ...righeColore(dark, 'color.semantic.dark'), '}', '}'];

  // Le @custom-media non si emettono più (ADR-0004 punto 4): il riferimento @media (--bp-<k>)
  // nei componenti è risolto da site/src/lib/breakpoint-visitor.mjs dentro Lightning CSS,
  // prima che la risoluzione delle @custom-media (drafts.customMedia) entri in gioco.
  return [root.join('\n'), scuro.join('\n')].join('\n\n') + '\n';
}

export default function tokenCssPlugin() {
  return {
    name: 'ownconsent-token-css',
    resolveId(id) {
      if (id === virtualModuleId) return resolvedVirtualModuleId;
      return undefined;
    },
    load(id) {
      if (id === resolvedVirtualModuleId) return generaTokenCss();
      return undefined;
    },
  };
}
