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
    // `astro preview` deve fallire sulla porta occupata, non ripiegare su un'altra.
    // Il collaudo chiede una porta libera al sistema operativo e la passa sia al comando
    // sia all'URL che interroga (playwright.config.ts). Se fra le due cose qualcuno
    // occupa quella porta, senza questa riga l'anteprima si sposta in silenzio sulla
    // successiva e Playwright resta a interrogare la porta chiesta — cioe' il server di
    // qualcun altro. Misurato, occupando la porta con un http.server e poi chiedendola:
    //
    //   senza strictPort:  "Port 41183 is in use, trying another one..."
    //                      poi "astro v7.3.3 ready ... http://127.0.0.1:41184/"
    //
    // Tocca solo `astro preview`: `astro build` non apre porte e `astro dev` legge
    // `vite.server`, non `vite.preview`. Fuori dal perimetro del collaudo (issue #8):
    // autorizzato da Andrea il 21/09/2026, registrato in DESIGN-AMENDMENTS.md (A04).
    preview: {
      strictPort: true,
    },
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
