import { defineConfig } from 'astro/config';
import tokenCss from './src/lib/token-css.mjs';
import { creaBreakpointVisitor } from './src/lib/breakpoint-visitor.mjs';
import sito from './src/dati/sito.json' with { type: 'json' };
import './src/lib/listino.mjs';

export default defineConfig({
  site: sito.url,
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
  vite: {
    plugins: [tokenCss()],
    css: {
      transformer: 'lightningcss',
      lightningcss: {
        // Il visitor risolve @media (--bp-<k>) leggendo contracts/design-tokens.json.
        // drafts.customMedia resta attivo: è il guardiano dei refusi (ADR-0004, punto 3).
        drafts: {
          customMedia: true,
        },
        visitor: creaBreakpointVisitor(),
      },
    },
    build: {
      // Browser supportati, deciso da Andrea il 20/09/2026 (ADR-0004, punto 5): ultime due
      // versioni maggiori di Chrome, Firefox ed Edge, più Safari e iOS dalla 15.4. Va qui
      // (vite.build.cssTarget) e non in vite.css.lightningcss.targets, misurato senza
      // effetto sulla sintassi delle media query emesse.
      cssTarget: ['chrome150', 'edge150', 'firefox153', 'safari15.4', 'ios15.4'],
    },
  },
});
