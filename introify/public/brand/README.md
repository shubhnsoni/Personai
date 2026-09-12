# Introify logo

The flowing person / lowercase-i symbol replaces the first letter of the outlined `introAsset 1.svg` wordmark. The remaining “ntroify” lettering keeps its original geometry and needs no font. All exports have transparent backgrounds.

- Symbol: standalone turquoise-to-blue gradient icon (`introify-symbol.svg`).
- Dark symbol: brighter mint, cyan and blue for dark backgrounds (`introify-symbol-dark.svg`). The inline icon automatically uses this palette in dark mode and on the dark authentication scene.
- Signature: white and cyan, with the brighter gradient symbol; for dark surfaces.
- Forest: deep green and blue, with the gradient symbol; for light site surfaces.
- Periwinkle: ink and violet; for the temporary landing study.
- Nightfall: white and lavender; for dark violet surfaces.
- Ink: single-colour dark, including the symbol.
- White: single-colour reverse, including the symbol.

The shared React wordmark includes the animated symbol with theme-aware lettering. Each inline symbol has unique gradient and filter IDs so repeated logos render reliably. Narrow onboarding navigation uses the symbol alone. Lockups use an `856.41 × 218.41` viewBox; the standalone symbol uses `176 × 176`. The original supplied file remains unchanged. Pass `animated={false}` for static exports; reduced-motion preferences show the complete still logo.

## Motion

The `motion/` folder contains transparent light and dark icon and wordmark SVGs. Each is a 2.8-second ribbon → gentle logo movement → trailing dot loop with a reduced-motion still fallback. See `motion/README.md` for embedding and regeneration instructions.
