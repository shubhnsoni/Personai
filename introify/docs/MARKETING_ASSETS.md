# Introify public-site artwork

The homepage uses three original generated photographs, created with the built-in image generation tool on 8 September 2026. The portraits and their stories are illustrative; they do not represent verified customers or testimonials. The page labels them accordingly. All other page visuals are native HTML/CSS and Lucide icons.

Saved assets:

- `public/marketing/ceramic-artist.png` — Mira, ceramic artist; homepage preview and people story.
- `public/marketing/design-consultant.png` — Arjun, independent design consultant; people story.
- `public/marketing/cafe-owner.png` — Leela, neighborhood café owner; people story.

## Ceramic artist prompt

Create one original photorealistic editorial photograph for a premium business-page website. A fictional adult Indian woman ceramic artist in her early thirties, at her bright independent pottery studio, warm confident subtle smile, natural skin texture, linen apron over a dark olive top. Waist-up portrait with hands naturally resting beside a handmade clay bowl on a workbench. Warm ivory plaster walls, restrained shelves with sculptural cream and terracotta vessels, soft side daylight. Contemporary independent-magazine photography, tactile and calm, gentle film grain, beautiful natural colors, not glossy stock advertising. Vertical 4:5 composition, face in upper third, breathing room and uncluttered background, suitable for cropping in a website profile preview. No text, no logos, no watermarks, no UI. Anatomically natural hands. This is an illustrative fictional profile, not a real customer endorsement.

## Design consultant prompt

Use case: photorealistic-natural. Create one original editorial portrait for an Introify website illustrative people story. Fictional adult Indian male independent design consultant, early thirties, short textured dark hair, subtle stubble, relaxed confidence. He sits at a warm contemporary home studio desk beside a paper notebook and closed laptop, wearing an understated deep navy overshirt and cream t-shirt. Soft window daylight, pale plaster wall, a modest plant and pinned abstract sketches behind him with no readable writing. Natural expressive face and skin texture, candid approachable half-smile toward camera. Independent magazine photography, tactile film colors, warm ivory and subdued blue, polished but human rather than corporate stock. Landscape 4:3 composition, medium waist-up portrait, face around center upper third, generous room around shoulders and studio context, useful crop for wide website story card. Natural hands resting on desk, no text, logos, watermark or UI. Not a real customer or endorsement.

## Café owner prompt

Use case: photorealistic-natural. Create one original editorial portrait for an Introify website illustrative people story. Fictional adult Indian woman neighborhood cafe owner, early forties, dark hair loosely tied back, warm welcoming smile, wearing a soft cream cotton shirt with a dark forest green apron. She stands behind a beautiful small independent cafe counter holding a plain ceramic coffee cup naturally. Warm wood, terracotta, softly lit green plants, afternoon window light, a few cups and modest espresso machine in the background, no readable signage. Candid independent-magazine photography, authentic natural skin and expression, restrained warm film palette, inviting and thoughtful, not glossy stock photography. Landscape 4:3 composition, medium waist-up portrait, face around center upper third, plenty of surrounding cafe context for wide website story card. No text, brand logos, watermark or UI. Anatomically natural hands. This is an illustrative fictional person, not a real customer endorsement.

## Rendering

Next.js Image serves responsive optimized variants. The sources are retained without modification; the added story portraits load lazily. The main text, navigation, FAQs, stories and product content render as HTML. Audience and scripted chat selectors are small client components with keyboard navigation. Native disclosure controls expand the people stories.
