# Edith Mina Lyre — Portfolio Site

A humble, professional portfolio site.

## Structure

```
edith-site/
├── index.html          # Home page
├── style.css           # Shared stylesheet
├── poems.html          # Poems index
├── stories.html        # Stories index  
├── essays.html         # Essays index
├── bio.html            # Bio page
├── contact.html        # Contact page
├── poems/              # Individual poem pages
├── stories/            # Individual story pages
└── essays/             # Individual essay pages
```

## Design Principles

- **EB Garamond** for typography (warm, literary)
- Dark background (#111) with light text (#d4d4d4)
- Minimal navigation, maximum readability
- No fog, no drama — just the work

## Adding Content

### To add a new poem:

1. Copy an existing poem file (e.g., `poems/good-again.html`)
2. Update the `<title>` and `<h1>`
3. Update the `work-meta` (year, type)
4. Replace the poem content in `poem-body`
5. Add the poem to `poems.html`

### To add a new story:

1. Copy `stories/engagement.html`
2. Update title, header, meta
3. Replace story content in `work-body`
4. Add to `stories.html`

### To add a new essay:

1. Copy `essays/nbp-deleted.html`
2. Update title, header, meta
3. Replace essay content in `essay-body`
4. Add to `essays.html`

## Remaining Pages to Create

### Poems (follow template in poems/):
- after-entropy.html
- leafland.html

### Stories (follow template in stories/):
- stamina.html
- handmirror.html
- correction-25.html
- last-khatun.html
- intersection.html
- ten-years-on.html
- mycenae-gate.html
- song-of-paris.html

### Essays (follow template in essays/):
- big-nothings.html
- broken-memory.html

## Deployment

Upload the entire folder to Cloudflare Pages, Netlify, or any static host.

No build step required — pure HTML/CSS.
