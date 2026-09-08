# Soft-locked PDP craft v1.3 LIGHT ("Better")

You are implementing Introify public shop PDP to match the Designer craft lock. Tip-chase OFF. Do NOT git push. Do NOT deploy. Do NOT reinstall CLI.

## Authority (read these first, match exactly)
- `.craft/pdp-v13/LOCK.md` — brand tokens, layout, content, out-of-scope
- `.craft/pdp-v13/desktop-light.html` + `desktop-light-full.png` — desktop visual target
- `.craft/pdp-v13/mobile-light.html` + `mobile-light-full.png` — mobile visual target
- `.craft/pdp-v13/ref-stacked-more.png` — stacked MORE deck reference

## Goal
Land a light-mode premium retail PDP that visually matches the craft frames for E2E Sunrise Pharmacy sample (Paracetamol 650). Prefer updating the live shop product route and related shop UI:

- `src/app/[slug]/shop/[id]/page.tsx`
- `src/components/shop/*` as needed (gallery, catalog, review, buy sheet, etc.)

If a dedicated craft/demo surface already exists for public shop PDP previews, use/extend that — but the result must match LOCK + frames.

## Locked visual rules
- Light only: fog `#f4f6f8` / white `#ffffff` — NEVER dark `#07080a`
- Ink `#0b1220`, secondary fog `#5c6570`
- Primary CTA cyan `#00d7ff` on `#061018`, pill radius 999px
- Accents electric blue sparingly (mark only)
- Radius ~0.75–1.1rem; soft borders + light shadows
- Desktop 2-col hero|buy; mobile stacked + sticky Order bar
- Sections: More details (stacked MORE deck) → From the brand (A+ band + 2-col + 3-up) → Reviews strip → quiet craft footer watermark
- UI copy = real pharmacy OTC voice — no meta "merchants upload" essays in UI
- No dashed annotation boxes / engineer-empty labels

## Constraints
- No git push / no deploy / no tip-chase
- No production checkout/API rewiring beyond what's needed for the craft UI to render
- Keep changes focused; one coherent land
- When done: summarize files changed + `git status` + `git rev-parse --short HEAD` (local SHA; commit only if a clean local commit is clearly useful — otherwise leave working tree ready and report status). Prefer committing locally with a clear message if the tree is ready, still NO push.

## Done criteria
- PDP light UI matches frames structurally (header, hero/thumbs, buy stack, more details, from the brand, reviews, footer)
- Mobile sticky Order present
- Light tokens honored (no dark regression)
- Report SHA + file list at end
