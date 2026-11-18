# DESIGN.md: MySpace & Blogger Era (2003-2008)

## Purpose

Recreate the customizable profile and blog era: user-styled backgrounds, Top 8 friend grids, auto-playing music widgets, glitter text, and busy sidebars full of badges and comments.

## Non-negotiable rules

- Every profile page must include a "Top 8" friend grid.
- Every profile page must include a music player widget, even as a placeholder, with a visible play control.
- Every profile page must include a "Comments" section and a "Friends" section.
- Use a custom background pattern or image, not a plain background.
- Use text shadows or glow on at least the headline.

## Colors (use these exact values)

Choose one theme per page from these:

- Pink theme: background `#FF66CC` with pattern, text `#FFFFFF`, accent `#FFFF00`, panel `#000000` at 70% opacity
- Purple theme: background `#663399`, text `#FFFFFF`, accent `#FF66FF`, panel `#330066`
- Black theme: background `#000000`, text `#00FF00`, accent `#FF0000`, panel `#111111`
- Blogger default: background `#FFFFFF`, text `#333333`, links `#0066CC`, accent `#CCCCCC`
- Allowed text shadow: `#FF00FF` or `#00FFFF`, 2px offset

## Typography

- Font stack: `Tahoma, Verdana, Arial, sans-serif`
- Headlines: 20px to 28px, bold, with text shadow
- Body: 12px to 14px
- Glitter or rainbow-colored text is allowed for names
- Use `<marquee>` once per profile for a scrolling status message

## Layout

- Two-column layout: main column 500px to 600px, sidebar 200px to 300px.
- Header: large name, a status line, and a banner image.
- Sidebar order: profile photo, Top 8, friends, music player, badges.
- Blogger variant: three columns (sidebar, main, right sidebar), 700px to 900px total width.

## Components

- Profile photo: 200x200px, bordered
- Top 8 Friends: 8 square avatars (100x100px) in a 2x4 or 4x2 grid, each with a name below
- Music player: a small embedded widget with a play button, track name, and a progress bar
- Comments: name, timestamp, message, and a small GIF or smiley
- Badges: small images or text badges such as "Born 1990" or "I Love Coffee"
- Blogger post: title, date stamp, body text, "Posted by" line, and comment count
- Quiz or survey box: a list of questions with check boxes
- "About Me" box: a few lines of bold text plus a bulleted list

## Imagery and effects

- Animated GIFs allowed in backgrounds and sidebars
- Sparkle or star separators
- Glitter text GIFs for headlines
- Background photos or repeating patterns
- Avatars and photo frames with thick colored borders

## Forbidden

- Flat design or minimalist white space as the main look
- Gradients on buttons, glossy effects, or skeuomorphic textures
- Rounded corners on the main panels (use square corners)
- Modern fonts such as Inter, Helvetica Neue, or SF Pro
- Single-color, low-contrast layouts without personality

## Output rules for AI

- Output one HTML file with inline CSS.
- Include the Top 8 grid, the music player, comments, and friends sections.
- Use only the color values listed above.
- Keep the main column and sidebar widths as stated.
