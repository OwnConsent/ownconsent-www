// Visitor di Lightning CSS che risolve @media (--bp-<k>) leggendo i breakpoint da
// contracts/design-tokens.json (ADR-0004). Gira dentro la stessa transform che il
// compilatore Astro invoca per i blocchi <style>, quindi raggiunge anche quelli — a
// differenza di un plugin Vite, che non li vede mai (ADR-0004, punto 2).
//
// drafts.customMedia resta attivo in astro.config.mjs: un riferimento non riconosciuto da
// questo visitor NON va riscritto, resta un @custom-media non definito e Lightning CSS lo
// segnala come errore di build. È il guardiano dei refusi (ADR-0004, punto 3).
import { leggiBreakpointPx } from './token-css.mjs';

const PREFISSO = '--bp-';

// Un nodo `feature` con `value` di tipo `boolean` e nome `--bp-<k>` è la forma che
// Lightning CSS assegna a un riferimento a @custom-media non ancora risolto.
function riconosciBreakpoint(feature) {
  return (
    feature &&
    feature.type === 'feature' &&
    feature.value &&
    feature.value.type === 'boolean' &&
    typeof feature.value.name === 'string' &&
    feature.value.name.startsWith(PREFISSO)
  );
}

function risolviFeature(feature, breakpoints) {
  const chiave = feature.value.name.slice(PREFISSO.length);
  if (!(chiave in breakpoints)) {
    // Non riconosciuto: resta invariato, così @custom-media non definito fa fallire la build.
    return feature;
  }
  const px = breakpoints[chiave];
  return {
    type: 'feature',
    value: {
      type: 'range',
      name: 'width',
      operator: 'greater-than-equal',
      value: {
        type: 'length',
        // `Length` va avvolto: senza questo involucro Lightning CSS risponde
        // "data did not match any variant of untagged enum MediaQueryOrRaw" (ADR-0004).
        value: {
          type: 'value',
          value: { unit: 'px', value: px },
        },
      },
    },
  };
}

// Ricorsivo sull'albero delle condizioni (ADR-0004, punto 2): in
// `@media (--bp-lg) and (orientation: landscape)` il riferimento è un figlio di un nodo
// `operation`, non una `feature` in cima. `segnalaCambiato` marca se qualcosa è stato
// sostituito, per evitare di ricostruire (e quindi rischiare di alterare) condizioni che
// il visitor non riguarda affatto.
function visitaCondizione(condizione, breakpoints, segnalaCambiato) {
  if (!condizione) return condizione;

  if (condizione.type === 'feature') {
    if (!riconosciBreakpoint(condizione)) return condizione;
    const risolta = risolviFeature(condizione, breakpoints);
    if (risolta !== condizione) segnalaCambiato();
    return risolta;
  }

  if (condizione.type === 'not') {
    return { type: 'not', value: visitaCondizione(condizione.value, breakpoints, segnalaCambiato) };
  }

  if (condizione.type === 'operation') {
    return {
      type: 'operation',
      operator: condizione.operator,
      conditions: condizione.conditions.map((c) => visitaCondizione(c, breakpoints, segnalaCambiato)),
    };
  }

  return condizione;
}

export function creaBreakpointVisitor() {
  const breakpoints = leggiBreakpointPx();

  return {
    MediaQuery(query) {
      if (!query.condition) return undefined;
      let cambiato = false;
      const nuovaCondizione = visitaCondizione(query.condition, breakpoints, () => {
        cambiato = true;
      });
      if (!cambiato) return undefined;
      return { ...query, condition: nuovaCondizione };
    },
  };
}

export default creaBreakpointVisitor;
