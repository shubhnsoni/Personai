# Introify icon and logo motion

Version 6 includes the open, hollow oval ribbon from the selected reference frames: a tapered blue sweep grows into a mint-tipped oval, holds visibly, and smoothly closes into the flowing icon before the trailing-dot exit. The same pose closes and opens the 2.8-second loop. There is no full rotation or camera orbit.

- `introify-symbol-light.svg` and `introify-symbol-dark.svg`: transparent animated icon, 176 × 176 viewBox.
- `introify-logo-light.svg` and `introify-logo-dark.svg`: transparent animated wordmark, 856.41 × 218.41 viewBox. The icon replaces the first “i”; the remaining lettering reads “ntroify”.
- 121 animation samples; 40 exported SVG frames per palette.
- Native SVG SMIL; no scripts, fonts, raster images, external requests or Lottie player.
- Reduced-motion preferences show the complete still icon and lettering.

Embed using an image or object element. Select the palette according to the actual background:

```html
<img src="/brand/motion/introify-logo-dark.svg"
     width="200" height="51" alt="Introify">
```

Some non-browser editors strip SVG animation. Use the numbered SVG frames when importing into those tools.

Regenerate from the app directory with `node scripts/generate-brand-motion.mjs`. Use `--preview` to also render the animated GIF. The generator reads the original icon path and the static wordmark exports, writes the animated assets and shared React motion data, and saves numbered frames and storyboards under the repository's ignored `.local/brand-motion` folder.
