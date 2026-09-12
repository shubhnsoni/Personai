# Introify motion studio

Run `node introify/scripts/brand-motion-studio/server.mjs` from the repository root, then open http://127.0.0.1:3107/. Stop any previous preview listening on that port first.

The studio uses the generated version 6 motion as its source. Controls affect all four previews and standalone SVG exports. Browser storage retains the current draft. Both save buttons now create the next numbered option, beginning at Option 2 after the locked Option 1. The top button includes the current keyframe draft whenever keyframes exist. Saving does not deploy.

The finalized data contains resampled animation tracks plus placement settings. An app implementation must apply the dot transform around (133, 49), ribbon transform around (88, 100), and lettering gap, using the same formulas in `editor.js`. Customized SVG downloads already include those transforms, timing, unique paint IDs, transparent padding for repositioned elements, and reduced-motion still artwork.

Settings JSON can be exported, imported, and restored from the last finalization. Reset changes only the browser draft. Reference, Snappy and Calm are editable presets, not separate assets. Phase timing controls apply to the full sequence; the ribbon and gentle sequences use closed progress curves. The first and last animation samples are identical for every setting.

The server binds to loopback only, validates settings, checks request origin for writes, limits request sizes and saves only to the fixed local output paths.

## 3D turn and keyframe takes

The opening turn uses a single shared 3D pivot at the ribbon's terminal cap. With **Attach dot to ribbon tip** enabled, dot placement is compensated during the turn so independent dot/ribbon offsets cannot separate them. X/Y/Z angles, direction, turn count, camera distance, depth and size affect the projected geometry. The pose blends into the original ribbon phase.

Scrub to a time, change controls and select **Add keyframe**. Select a keyframe to edit its pose, adjust its time, or delete it. **Record changes** plays one pass and captures control edits; **Stop recording** closes the pass. **Play keyframes** compiles smooth interpolation and plays the saved poses on the take's own duration. When returning to the first pose is enabled, the final segment returns to the initial pose.

**Save take as Option N** creates unique settings and compiled motion files in `.local/brand-motion/takes` and a complete locked option in `public/brand/motion/options/option-N`. **Save Option N** at the top also includes all draft keyframes; when none exist it saves a settings-only animation. A one-keyframe draft must be completed before saving. Each new save gets a new number, while retrying an interrupted save keeps its original number.

Every option contains its settings, exact compiled motion, keyframes when present, four transparent SVGs, a preview page, and a file-hash manifest. The gallery at `/brand/motion/options/index.html` lists all options. Previous options are never overwritten. The old standalone test/sample takes remain in the saved-takes list until explicitly saved as an option.

Saved takes can be reloaded and exported as JSON. SVG downloads include the active take, with placements baked into the animation and a frozen final frame for non-looping takes. The top save also updates `.local/brand-motion/finalized-settings.json` and `.local/brand-motion/finalized-motion-data.json` for implementation.

Validation: `node --test introify/scripts/brand-motion-studio/*.test.mjs` from the repository root checks attachment, interpolation, validation, sequential option numbering, retry safety, file hashes and complete SVG/keyframe exports.

### Playback range

Start & end at the top of Motion controls selects a source interval in seconds. Use the timeline with Set start here / Set end here, or enter times. Use full animation restores the complete sequence. The range scales with playback speed and is included in settings JSON, saved options, keyframe takes and SVG exports. Keyframes retain their full source timeline; trimming is applied after baking the take. Recording captures the full take, with range controls disabled until recording stops. Trimmed endpoints are preserved and may form a visible jump when looping.
