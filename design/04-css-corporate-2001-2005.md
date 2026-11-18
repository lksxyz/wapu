# DESIGN.md: Early CSS Corporate (2001-2005)

## Purpose

Recreate the clean, conservative corporate and tech sites of the early CSS era: centered fixed-width layouts, blue and gray palettes, top navigation, and sans-serif type.

## Non-negotiable rules

- Use a centered container of 960px width.
- Use CSS for layout, but keep it simple: floats or basic block layout only. No CSS grid, no flexbox.
- Navigation sits in a horizontal bar at the top.
- No more than one animated element per page, and it must be small.

## Colors (exact)

- Page background: `#FFFFFF`
- Header background: `#003366` (navy)
- Primary accent: `#0066CC` (blue)
- Secondary text: `#666666`
- Body text: `#333333`
- Light panel background: `#F4F4F4`
- Border: `#CCCCCC` (1px solid)
- Footer background: `#EEEEEE`
- Link color: `#0066CC`, hover `#003366`, underline on hover only

## Typography

- Font stack: `Verdana, Arial, Helvetica, sans-serif`
- Body: 13px, line height 1.5
- H1: 24px, `#003366`, bold
- H2: 18px, `#0066CC`, bold
- H3: 14px, `#333333`, bold
- Navigation links: 12px, uppercase, white on `#003366`

## Layout

- Container: 960px wide, centered (`margin: 0 auto`).
- Header: logo or site name left, tagline right, height about 90px.
- Top nav bar: full-width `#003366` band with horizontal links separated by spacing or thin vertical dividers.
- Main area: content column about 650px, sidebar about 260px on the right.
- Sidebar: panels with `#F4F4F4` background and a 1px `#CCCCCC` border.
- Footer: `#EEEEEE` band with copyright, links, and a small address block.

## Components

- Top navigation bar: Home, Products, Services, About, News, Contact
- Hero or featured block: image left, text right, a "Learn more" link
- News list: date in `#666666`, headline link, one-line summary
- Sidebar box: heading bar in `#0066CC`, list of links
- Contact block: address, phone, email in the footer
- Buttons: solid `#0066CC` background, white text, 4px border radius maximum, no gradients

## Imagery and effects

- Photos with 1px `#CCCCCC` border.
- Simple logo mark, no glossy or 3D effects.
- Allowed effect: one small animated banner or Flash slider per page, optional.
- Icons: small flat icons only, no gradients.

## Forbidden

- Gradients, glossy surfaces, reflections, or skeuomorphic textures
- Neon, bright, or saturated colors outside the palette above
- Rounded corners larger than 4px
- Heavy drop shadows
- Modern fonts such as Inter or SF Pro
- Full-page parallax or scroll animations

## Output rules for AI

- Output one HTML file with a single `<style>` block.
- Use the exact colors and fonts listed above.
- Keep the container at 960px.
- Do not use flexbox or grid.
