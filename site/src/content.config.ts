// Collezione unica «legale» (ADR-0002 D7): schema rigido, una chiave sconosciuta o
// bozza diversa da true fanno fallire la build. I file Markdown li scrive L04.
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const legale = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/legale' }),
  schema: z
    .object({
      titolo: z.string().min(1),
      descrizione: z.string().min(1),
      bozza: z.literal(true),
    })
    .strict(),
});

export const collections = { legale };
