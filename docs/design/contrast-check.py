#!/usr/bin/env python3
"""Calcola il rapporto di contrasto WCAG 2.2 per le coppie testo/sfondo e per i
componenti di interfaccia dichiarati in contracts/design-tokens.json.

Non deduce, calcola: implementa la formula di luminanza relativa e di contrasto
di WCAG 2.1/2.2 (la stessa usata da AA per il criterio 1.4.3 e 1.4.11) e la
applica ai valori esadecimali effettivamente scritti nel contratto.

Uso:
    python3 docs/design/contrast-check.py

Uscita diversa da zero se una coppia marcata come obbligatoria non raggiunge
la soglia richiesta (4.5:1 per testo normale, 3:1 per testo grande e
componenti di interfaccia).
"""
import json
import sys
from pathlib import Path

TOKENS_PATH = Path(__file__).resolve().parents[2] / "contracts" / "design-tokens.json"


def hex_to_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))


def channel_to_linear(c: int) -> float:
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def relative_luminance(hex_value: str) -> float:
    r, g, b = hex_to_rgb(hex_value)
    r_lin, g_lin, b_lin = (channel_to_linear(c) for c in (r, g, b))
    return 0.2126 * r_lin + 0.7152 * g_lin + 0.0722 * b_lin


def contrast_ratio(hex_a: str, hex_b: str) -> float:
    l1 = relative_luminance(hex_a)
    l2 = relative_luminance(hex_b)
    lighter, darker = max(l1, l2), min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)


# Ogni voce: (etichetta, token testo/elemento, token sfondo, soglia minima)
# soglia 4.5 = testo normale (WCAG 1.4.3 AA); 3.0 = testo grande o componente
# di interfaccia (WCAG 1.4.3 large text AA, 1.4.11 AA).
PAIRS = [
    # --- tema chiaro ---
    ("chiaro: testo primario su canvas", "text-primary", "bg-canvas", 4.5),
    ("chiaro: testo primario su surface", "text-primary", "bg-surface", 4.5),
    ("chiaro: testo secondario su canvas", "text-secondary", "bg-canvas", 4.5),
    ("chiaro: testo secondario su surface", "text-secondary", "bg-surface", 4.5),
    ("chiaro: testo muto su canvas", "text-muted", "bg-canvas", 4.5),
    ("chiaro: link su canvas", "text-link", "bg-canvas", 4.5),
    ("chiaro: link su surface", "text-link", "bg-surface", 4.5),
    ("chiaro: testo su sfondo brand (CTA)", "text-on-brand", "brand-bg", 4.5),
    ("chiaro: testo su sfondo brand hover", "text-on-brand", "brand-bg-hover", 4.5),
    ("chiaro: testo primario su inverse (footer)", "text-on-inverse", "bg-inverse", 4.5),
    ("chiaro: testo badge demo", "badge-demo-text", "badge-demo-bg", 4.5),
    ("chiaro: testo badge bozza", "badge-draft-text", "badge-draft-bg", 4.5),
    ("chiaro: bordo default su canvas (componente UI)", "border-default", "bg-canvas", 3.0),
    ("chiaro: bordo forte su canvas (componente UI)", "border-strong", "bg-canvas", 3.0),
    ("chiaro: focus ring su canvas (componente UI)", "focus-ring", "bg-canvas", 3.0),
    ("chiaro: focus ring su surface (componente UI)", "focus-ring", "bg-surface", 3.0),
    ("chiaro: focus ring su inverse (componente UI, footer)", "focus-ring-on-inverse", "bg-inverse", 3.0),
    ("chiaro: sfondo brand su canvas (componente UI, bottone)", "brand-bg", "bg-canvas", 3.0),
    # --- tema scuro ---
    ("scuro: testo primario su canvas", "text-primary", "bg-canvas", 4.5),
    ("scuro: testo primario su surface", "text-primary", "bg-surface", 4.5),
    ("scuro: testo secondario su canvas", "text-secondary", "bg-canvas", 4.5),
    ("scuro: testo secondario su surface", "text-secondary", "bg-surface", 4.5),
    ("scuro: testo muto su canvas", "text-muted", "bg-canvas", 4.5),
    ("scuro: link su canvas", "text-link", "bg-canvas", 4.5),
    ("scuro: link su surface", "text-link", "bg-surface", 4.5),
    ("scuro: testo su sfondo brand (CTA)", "text-on-brand", "brand-bg", 4.5),
    ("scuro: testo su sfondo brand hover", "text-on-brand", "brand-bg-hover", 4.5),
    ("scuro: testo primario su inverse (footer)", "text-on-inverse", "bg-inverse", 4.5),
    ("scuro: testo badge demo", "badge-demo-text", "badge-demo-bg", 4.5),
    ("scuro: testo badge bozza", "badge-draft-text", "badge-draft-bg", 4.5),
    ("scuro: bordo default su canvas (componente UI)", "border-default", "bg-canvas", 3.0),
    ("scuro: bordo forte su canvas (componente UI)", "border-strong", "bg-canvas", 3.0),
    ("scuro: focus ring su canvas (componente UI)", "focus-ring", "bg-canvas", 3.0),
    ("scuro: focus ring su surface (componente UI)", "focus-ring", "bg-surface", 3.0),
    ("scuro: focus ring su inverse (componente UI, footer)", "focus-ring-on-inverse", "bg-inverse", 3.0),
    ("scuro: sfondo brand su canvas (componente UI, bottone)", "brand-bg", "bg-canvas", 3.0),
]

# Nota sul focus ring: non si verifica la coppia focus-ring/brand-bg, e non è
# fra le coppie obbligatorie sopra. La garanzia non è di colore ma strutturale:
# ADR-0002 D6 impone lo scarto (focus.ring-offset, 2px) dentro un `@layer`
# dichiarato prima di ogni altro stile, così l'anello del bottone tocca sempre
# bg-canvas o bg-surface (già verificati sopra), mai brand-bg direttamente.
# Nessun componente di questa consegna può disegnare quel focus ring senza
# quello scarto: per questo qui non c'è un valore di colore da controllare.
# Il footer è il solo caso reale in cui l'anello è adiacente a uno sfondo di
# superficie diverso da canvas/surface (bg-inverse), e per quello la coppia
# sopra (focus-ring-on-inverse/bg-inverse) è obbligatoria.


def main() -> int:
    data = json.loads(TOKENS_PATH.read_text(encoding="utf-8"))
    temi = data["color"]["semantic"]
    ok = True
    print(f"{'coppia':<55}{'valori':<25}{'rapporto':>10}  soglia  esito")
    print("-" * 105)
    for etichetta, tok_testo, tok_sfondo, soglia in PAIRS:
        tema = "dark" if etichetta.startswith("scuro") else "light"
        hex_testo = temi[tema][tok_testo]["value"]
        hex_sfondo = temi[tema][tok_sfondo]["value"]
        ratio = contrast_ratio(hex_testo, hex_sfondo)
        passed = ratio >= soglia
        ok = ok and passed
        esito = "PASS" if passed else "FAIL"
        valori = f"{hex_testo} / {hex_sfondo}"
        print(f"{etichetta:<55}{valori:<25}{ratio:>9.2f}:1  {soglia:>5.1f}:1  {esito}")
    print("-" * 105)
    print("TUTTE LE COPPIE OBBLIGATORIE PASSANO" if ok else "ALMENO UNA COPPIA FALLISCE — non committare")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
