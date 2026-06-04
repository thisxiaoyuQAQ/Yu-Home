# Black-and-White Minimal Homepage Redesign

Date: 2026-06-05

## Goal

Turn the current particle-heavy personal homepage into a clean black-and-white minimalist single-page site while preserving the existing section structure:

1. Hero
2. About
3. Skills
4. Projects
5. Contact

The redesign should remove visual noise, improve readability, and keep the page feeling technical, quiet, and focused.

## Approved Direction

Use a restrained black-and-white style based on the current content and layout. Keep the existing one-page portfolio flow, but remove the Three.js particle systems, colorful gradients, glow effects, and particle-based mouse interactions.

The result should feel like a polished minimalist personal homepage, not a sci-fi animation showcase.

## Visual System

### Palette

- Background: pure black or near-black (`#000000`)
- Primary text: white
- Secondary text: translucent white (`white/60`, `white/50`, `white/40`)
- Borders and dividers: subtle translucent white (`white/10`, `white/15`)
- Hover state: slightly stronger white opacity or minor positional movement

No purple, amber, bloom, galaxy colors, or saturated accent colors should remain in the visible page UI.

### Motion

Keep only lightweight CSS motion:

- Existing section fade/slide-in animations may remain.
- Skill bar fill animation may remain.
- Simple hover transitions may remain.

Remove particle animation, WebGL backgrounds, black hole simulation, and large decorative glow motion.

### Layout

Keep generous spacing and clear hierarchy:

- Large section headings
- Thin divider lines
- Wide black negative space
- Minimal cards/lists with subtle borders
- No dense background visuals behind text

## Section Design

### Hero

Keep the hero as a centered full-screen introduction:

- Main title: `Zhi Yu`
- Subtitle: `Developer & Creator`
- Quote: `为天地立心，为生民立命，为往圣继绝学，为万世开太平`

Remove `HeroParticles` and colorful text effects. The hero should use simple white/gray typography on black, with optional fine dividers or very subtle monochrome decoration.

### About

Keep the current personal introduction and stats. Remove `AboutParticles` and purple background overlays. Use a black section background, white text, gray secondary paragraphs, and simple dividers.

### Skills

Keep the skill list and progress bars. Remove `SkillsParticles` and mouse-state interaction. Progress bars should remain monochrome, using white/gray fills only.

### Projects

Keep the project list layout and links. Remove `ProjectsParticles` and radial particle vignettes. Project rows should remain clean, with subtle borders and hover states.

### Contact

Keep the contact links and footer. Remove `ContactBlackHole`. Use simple centered text, bordered link rows, and minimal monochrome decorative lines if needed.

## Implementation Boundaries

First implementation pass should disconnect particle systems from the visible page instead of deleting every particle file immediately. This lowers risk and makes it easy to compare before/after if needed.

Likely affected files:

- `components/Hero.tsx`
- `components/About.tsx`
- `components/Skills.tsx`
- `components/Projects.tsx`
- `components/Contact.tsx`
- `app/globals.css`
- `README.md` after the UI change is complete

Particle component files may remain unused in the first pass:

- `components/HeroParticles.tsx`
- `components/AboutParticles.tsx`
- `components/SkillsParticles.tsx`
- `components/ProjectsParticles.tsx`
- `components/ContactBlackHole.tsx`

## Testing and Verification

After implementation:

1. Run the project build or available static checks.
2. Confirm no visible particle effects remain.
3. Confirm no visible purple/orange glow styling remains.
4. Confirm all five sections still render.
5. Confirm project and contact links remain usable.
6. Optionally run the app locally and inspect the homepage visually.

## Non-goals

- Do not redesign the site into a one-screen business card.
- Do not remove About, Skills, Projects, or Contact.
- Do not rewrite project content unless needed for visual consistency.
- Do not introduce a new design library.
- Do not add new 3D, canvas, shader, or particle effects.
