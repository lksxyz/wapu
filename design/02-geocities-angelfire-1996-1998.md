# DESIGN.md: Geocities & Angelfire (1996-1998)

## Purpose

Recreate the personal homepage era: tiled backgrounds, bright colors, animated GIFs, visitor counters, guestbooks, and webrings on free hosting sites.

## Non-negotiable rules

- Every page must have a visible visitor counter and a guestbook link.
- Every page must have at least one animated GIF element (decorative, not functional).
- Every page must include a footer reading "Best viewed in 800x600 with Netscape Navigator or Internet Explorer 4.0+."
- Use `<marquee>` for at least one scrolling line of text per page.

## Colors (use these exact values)

Pick one color scheme per page from these four:

- Scheme A (classic): background `#000080` (navy), text `#FFFF00` (yellow), links `#00FFFF` (cyan), visited `#FF00FF` (magenta)
- Scheme B (light): background `#FFFFFF`, text `#000000`, links `#0000FF`, visited `#800080`
- Scheme C (hot): background `#000000`, text `#00FF00` (green), links `#FF0000`, visited `#FF00FF`
- Scheme D (retro gray): background `#C0C0C0`, text `#000000`, links `#0000FF`, visited `#800080`
- Accent colors allowed: `#FF0000`, `#00FF00`, `#0000FF`, `#FFFF00`, `#FF00FF`, `#00FFFF`
- Background pattern: a small tiled image (16x16 or 32x32 px) set as `background-image`. Do not use gradients.

## Typography

- Font stack: `Comic Sans MS, Verdana, Arial, sans-serif`
- Headings: `Impact` or `Comic Sans MS`, bold, 24px to 36px
- Body text: 12px to 14px
- Text may be bold, italic, underlined, or all caps for emphasis
- Text effects allowed: `<blink>` (use at most once per page), `<marquee>`, rainbow-colored letters

## Layout

- Centered table or block, width 600px to 800px.
- Sections stacked vertically, separated by animated GIF dividers or `<hr>` with a bright color.
- Navigation: a row of bordered text links or a table of buttons, usually at the top.

## Components

- Header: large animated "NEW!" or "Welcome to my homepage!" banner GIF plus a title
- About me section with a photo and a bulleted list of interests
- Guestbook link and visitor counter (text like "You are visitor #0042")
- Webring footer with "Previous | Random | Next" links
- "Under construction" GIF on at least one linked page
- Email link: "E-mail me!"
- Footer: "Best viewed in 800x600" line and "Last updated" date

## Imagery and effects

- Animated GIFs only. No SVG, no icon fonts, no flat icons.
- Clip-art style bullets and sparkle or star separators.
- Optional: looping background music with an `<embed>` or `<bgsound>` tag and a visible "Music on/off" control.

## Forbidden

- Flat design, minimalism, white space as the main design element
- Rounded cards, shadows, gradients, glassmorphism
- Modern fonts such as Inter, Helvetica Neue, or system UI fonts
- Dark, neutral palettes that look corporate
- Responsive layouts

## Output rules for AI

- Output one HTML file. Inline CSS is allowed only for the background, colors, fonts, and table width.
- Include at least one `<marquee>`, one visitor counter, one guestbook link, and the "Best viewed" footer.
- Use only the color values listed above.
