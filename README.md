# Krishna's Blog

> Practical tutorials on building AI agents, LLMs, and developer tooling.

**Live site**: https://krishnamohan-seelam.github.io/my-blog/

---

## About

A technical blog covering hands-on tutorials and deep dives on:
- **AI Agents** — LangGraph, ReAct, Planner-Executor patterns
- **LLMs** — prompt engineering, function calling, multi-step reasoning
- **Databases** — MongoDB vector search, RAG architectures
- **Developer tools** — practical walkthroughs with working code

---

## Stack

- **Jekyll 4.4.1** — static site generator
- **GitHub Pages** — hosting
- **minima 2.5** — theme base (heavily customized)
- **Plugins**: `jekyll-feed`, `jekyll-sitemap`, `jekyll-paginate`, `jekyll-seo-tag`
- **Fonts**: Instrument Serif, DM Mono, DM Sans (Google Fonts)

---

## Features (v2 — UI/UX Redesign)

- 🌗 **Dark/light mode** — persisted via `localStorage`, respects `prefers-color-scheme`
- 📐 **Two-column home** — post list + sticky sidebar (68% / 32%)
- 🏷️ **Tag filter chips** — client-side filter, no page reload
- 📖 **Reading experience** — 18px body, 680px content width, 1.82 line-height
- 📊 **Reading progress bar** — thin accent bar at top of post pages
- 📋 **Table of contents** — dynamically generated in JS, sticky desktop, collapsible mobile; 3+ headings auto-trigger
- 📋 **Copy code button** — on all code blocks with language label
- 🔗 **Share buttons** — Twitter/X, LinkedIn, copy-link
- 🔄 **Post navigation** — prev/next with title
- 🔗 **Related posts** — by shared tag (up to 3)
- ⬆️ **Back to top** — appears after 400px scroll
- 🏷️ **Tag index** — `/tags/` page listing all posts by tag
- 📄 **Custom 404**
- 📡 **Open Graph + Twitter Card + JSON-LD** SEO
- ♿ **Accessible** — skip-link, aria labels, focus rings, semantic HTML

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
