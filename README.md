# Krishna's Blog

> Practical tutorials on building AI agents, LLMs, and developer tooling.

**Live site**: https://krishnamohan-seelam.github.io/my-blog/

---

## About

A technical blog covering hands-on tutorials and deep dives on:
- **AI Agents** — LangGraph, ReAct, Planner-Executor patterns
- **LLMs & Prompt Engineering** — CO-STAR/RISEN frameworks, token optimization, prompt safety, 6-stage SWE lifecycle integration
- **Databases** — MongoDB vector search, RAG architectures
- **Developer tools** — practical walkthroughs with working code

---

## Stack

- **Jekyll 4.4.1** — static site generator
- **GitHub Pages** — hosting
- **minima 2.5** — theme base (custom Dev Magazine layout)
- **Plugins**: `jekyll-feed`, `jekyll-sitemap`, `jekyll-paginate`, `jekyll-seo-tag`
- **Fonts**: Plus Jakarta Sans (800 Display), Inter (Body), JetBrains Mono (Code/Meta)

---

## Features (v3 — Dev Magazine UI/UX Redesign)

- 🎨 **Option 1 Modern Tech Typography** — Plus Jakarta Sans display headings, Inter body prose, JetBrains Mono code & metadata
- 📰 **Design-B Homepage** — hero micro-profile, single-line headline *"Developer tooling for AI agents"*, and 2-column glassmorphic card grid
- 👤 **Relocated Author Bio** — integrated into homepage hero header and post-footer Author Card (removing right-sidebar clutter)
- 🏷️ **In-Page Topic Filter** — interactive tag chips filtering post cards instantly without page reloads or 404s
- 🌗 **Dark/light mode** — persisted via `localStorage`, respects `prefers-color-scheme`
- 🔍 **Client-side search** — fast fuzzy matching overlay powered by Simple-Jekyll-Search
- 📖 **Reading experience** — 17px body, 700px content width, 1.78 line-height
- 📊 **Reading progress bar** — thin accent bar at top of post pages
- 📋 **Table of contents** — dynamically generated in JS, sticky desktop, collapsible mobile; 3+ headings auto-trigger
- 📋 **Copy code button** — on all code blocks with language label
- 🖼️ **Flexible Header Banner** — supports both `cover_image` and `image` frontmatter with gradient fallback
- 🔗 **Share buttons** — Twitter/X, LinkedIn, copy-link
- 🔄 **Post navigation** — prev/next with title
- 🔗 **Related posts** — by shared tag (up to 3)
- ⬆️ **Back to top** — appears after 280px scroll
- 🏷️ **Tag index** — `/tags/` page listing all posts by tag
- 📄 **Custom 404**
- 📡 **Open Graph + Twitter Card + JSON-LD** SEO
- ♿ **Accessible & Color-Blind Friendly** — skip-link, aria labels, focus rings, semantic HTML, non-color dependent state indicators

---

## Local Development

```bash
bundle install
bundle exec jekyll serve --livereload
# → http://127.0.0.1:4000/my-blog/
```

---

## Adding Posts

Create `_posts/YYYY-MM-DD-post-slug.md`:

```yaml
---
layout: post
title: "Your Post Title"
date: 2026-07-05
categories: ai python
tags: [AI Agents, LangGraph, Tutorial]
description: "One-line summary for SEO and post card excerpt (optional)"
cover_image: /assets/images/your-cover.jpg  # optional
---
```

---

## Documentation

- [Architecture](DOCS/ARCHITECTURE.md) — file structure, design system, data flow
- [Phase Completion](DOCS/PHASE_COMPLETION.md) — redesign history

---

## Author

**Krishna Mohan Seelam** — [GitHub](https://github.com/krishnamohan-seelam) · [LinkedIn](https://www.linkedin.com/in/krishnamohanseelam)
