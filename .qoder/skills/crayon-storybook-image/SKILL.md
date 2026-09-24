---
name: crayon-storybook-image
description: Generate or refine images in a consistent warm crayon children’s-picture-book style based on the bundled reference image. Use when the user asks for the same style, this picture-book/crayon/oil-pastel look, "一眼画风", "这个画风", or recurring scene illustrations with thick black outlines, wax-crayon texture, visible paper grain, bright warm colors, and playful childlike proportions.
---

# Crayon Storybook Image

## Overview

Use this skill to turn a user's scene idea into a reusable image-generation prompt in the same crayon storybook style as the bundled reference image.

Use the bundled asset as a style reference only:

`assets/crayon-storybook-style-reference.png`

Do not copy the reference image's characters, poses, puddle scene, tree, clothing, or composition unless the user explicitly asks for those subject details. Preserve only the visual language.

## Workflow

1. Treat the user's request as a new image generation unless they explicitly ask to edit an existing image.
2. Use the built-in `image_gen` tool by default for normal generation.
3. If the user gives only a short scene, expand it into a complete prompt using the style recipe below.
4. Keep the user's subject, characters, setting, and mood as the source of truth.
5. Add scene-specific props and action details only when they naturally support the requested scene.
6. Avoid text, logos, watermarks, photorealism, 3D render style, anime polish, and clean vector edges unless requested.
7. If the output is meant for a project or deliverable, copy the final generated image into the workspace or requested output location.
8. After generation, provide a complete English filename for the image using the filename rules below.

## Style Recipe

Always include these style constraints in the generation prompt:

- Warm children's picture-book illustration.
- Thick black hand-drawn outlines with slightly wobbly, imperfect contours.
- Wax crayon or oil pastel strokes, short overlapping scribbles, rough white highlight scratches, and visible paper fiber texture.
- Bright, warm, cheerful colors with lively contrast.
- Simple rounded faces, rosy cheeks, expressive dot eyes, small noses, and exaggerated smiles or reactions.
- Childlike proportions and playful imperfect perspective.
- Full, readable scene composition with enough background detail to identify the place.
- Horizontal composition unless the user asks for another format.

## Prompt Template

Use this structure and fill only what helps the request:

```text
Create a new children's picture-book illustration in the same visual style as the bundled reference image, using the reference only for style and not copying its content.

Scene: [user's requested scene].
Characters: [who is present, age/relationship if given, clothing or props if relevant].
Action: [clear main action with expressive, slightly chaotic or warm details when appropriate].
Setting: [background elements that make the place immediately recognizable].
Composition: horizontal picture-book page, main characters centered or clearly readable, lively but not overcrowded.
Style: thick black hand-drawn outlines, wax crayon/oil pastel texture, visible paper grain, bright warm colors, loose short scribble strokes, imperfect childlike proportions, rosy cheeks, playful expressions.
Avoid: text, captions, watermark, photorealism, 3D render, anime style, clean vector art, copying the reference image's exact subjects or composition.
```

## Scene Expansion Rules

For family or child scenes, emphasize warmth, motion, safe messiness, and expressive faces.

For indoor scenes, include a few recognizable room objects in the background, but keep the characters dominant.

For outdoor scenes, use broad scribbled areas of sky, foliage, ground, or water, with energetic lines and visible paper texture.

For food, craft, school, play, or holiday scenes, add small scattered props that support the action and make the page feel alive.

If the user asks for a series, keep a consistent visual recipe while varying composition, props, and character action per scene.

## Filename Rules

Always suggest or use a complete English filename after each generated image.

Use lowercase kebab-case with `.png` by default:

```text
[main-subject]-[action]-[setting]-crayon-storybook.png
```

Keep filenames descriptive but not too long. Prefer 5 to 9 meaningful words before the extension. Include:

- Main subject or relationship, such as `father-child`, `family`, `girl`, `siblings`, or `grandma-grandchild`.
- Main action, such as `cooking`, `reading`, `planting`, `picnic`, or `building-blocks`.
- Main setting, such as `kitchen`, `bedroom`, `park`, `classroom`, or `garden`.
- The style suffix `crayon-storybook`.

Use only ASCII letters, numbers, and hyphens. Do not use spaces, underscores, dates, Chinese characters, or vague words such as `image`, `final`, or `new` unless the user asks for them.

If there are multiple images in a series, append a short sequence number before the extension:

```text
[main-subject]-[action]-[setting]-crayon-storybook-01.png
```

## Example

User request:

```text
生成一张厨房里，爸爸和孩子系着围裙、手忙脚乱地一起做饭
```

Prompt:

```text
Create a new children's picture-book illustration in the same visual style as the bundled reference image, using the reference only for style and not copying its content.

Scene: a cozy family kitchen where a father and child are making dinner together.
Characters: the father and child both wear aprons; the child stands safely on a small stool.
Action: the father stirs a pot while looking surprised at splashing batter, and the child joyfully cracks an egg or sprinkles flour; the moment feels busy, funny, and loving.
Setting: cabinets, window, stovetop, table, bowls, spoon, cutting board, tomatoes, carrots, vegetables, flour bag, and a pot with playful steam.
Composition: horizontal picture-book page, father and child as the clear center, kitchen details around them, lively but not overcrowded.
Style: thick black hand-drawn outlines, wax crayon/oil pastel texture, visible paper grain, bright warm colors, loose short scribble strokes, imperfect childlike proportions, rosy cheeks, playful expressions.
Avoid: text, captions, watermark, photorealism, 3D render, anime style, clean vector art, copying the reference image's exact subjects or composition.
```

Filename:

```text
father-child-chaotic-kitchen-cooking-crayon-storybook.png
```
