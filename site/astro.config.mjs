import { defineConfig } from 'astro/config';
import tokenCss from './src/lib/token-css.mjs';
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
        drafts: {
          customMedia: true,
        },
      },
    },
  },
});
