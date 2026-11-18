# DESIGN.md: Flash & Table Layouts (1998-2002)

## Purpose

Recreate the commercial and portfolio sites of the late 1990s and early 2000s: HTML table layouts, Flash intros, rollover buttons, and beveled navigation.

## Non-negotiable rules

- Use HTML tables for the page layout. Do not use CSS for positioning.
- Every page must start with a splash screen or intro, and the splash screen must include a "Skip Intro" link.
- Navigation must use rollover or beveled button styling.
- Use a fixed-width centered layout of 760px.

## Colors (exact)

- Page background: `#FFFFFF` or `#CCCCCC`
- Header/nav background: `#000066` (navy) or `#003399` (blue)
- Accent: `#FFCC00` (gold)
- Body text: `#000000`
- Secondary text: `#333333`
- Border lines: `#999999` (1px)
- Splash screen background: `#000000` with white or gold text
- Links: `#003399` (unvisited), `#660066` (visited)

## Typography

- Font stack: `Verdana, Arial, Helvetica, sans-serif`
- Body text: 10px to 12px
- Navigation labels: 11px, uppercase, bold
- Headings: 16px to 24px, bold, `#003399` or `#000066`
- Use `<font>` elements where needed for color and size, as period HTML did

## Layout

- Outer table: width 760px, cellspacing 0, cellpadding 0, centered.
- Header row: logo image on the left, a banner on the right.
- Left column (about 150px): stacked navigation buttons.
- Content cell: 580px, with a headline, body copy, and an image or two.
- Footer row: copyright line, "Best viewed at 1024x768" note, and a small text nav.

## Components

- Splash intro: full-screen black background, centered logo or animated title, "Skip Intro" link at the bottom right, auto-advance after about 5 seconds.
- Navigation buttons: beveled, 1px outset border, gradient-free solid fill, change color on hover (for example `#000066` to `#FFCC00`).
- Background music: a small "Sound On/Off" toggle in the header.
- Contact form: a basic HTML form with text inputs and a Submit button in default browser styling.
- "Enter site" button on the splash screen.

## Imagery and effects

- Small GIF or JPG images with visible borders.
- Simple Flash-style animations: fade-in text, slide-in logo, timed transitions.
- Icons: small bullets or arrow GIFs.

## Forbidden

- CSS flexbox, grid, or any responsive layout
- Parallax, scroll effects, or smooth animation libraries
- Flat design with no borders or bevels
- Rounded corners on buttons
- Modern sans-serif fonts such as Inter or Helvetica Neue
- Dark-mode or minimalist styling

## Output rules for AI

- Use tables for all page structure.
- Include a splash screen with a Skip Intro link.
- Keep the outer table at 760px width.
- Use only colors listed above.
