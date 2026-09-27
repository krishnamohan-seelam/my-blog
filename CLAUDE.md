# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Jekyll 4.4.1 static blog (theme base `minima` 2.5, heavily overridden) hosted on GitHub Pages at `https://krishnamohan-seelam.github.io/my-blog/`. Content is technical tutorials on AI agents, LLMs, prompt engineering, and developer tooling.

## Commands

```bash
bundle install                              # install gems
bundle exec jekyll serve --livereload       # local dev server → http://127.0.0.1:4000/my-blog/
bundle exec jekyll build --baseurl "/my-blog"  # production build (mirrors CI)
```

There is no test suite or linter configured. `.venv` and `pyscripts/` hold a standalone Python helper (`generate_newsletter_draft.py`) unrelated to the Jekyll build; it's excluded from Jekyll processing in `_config.yml`.

Deployment is automatic via `.github/workflows/jekyll-gh-pages.yml` on push to `main` — it runs `bundle exec jekyll build` on `ubuntu-latest` and deploys `_site/` to GitHub Pages. If `Gemfile.lock` platform mismatches arise (Windows dev vs. Linux CI), run:
```bash
bundle lock --add-platform x86_64-linux
bundle lock --add-platform ruby
```

Only GitHub Pages-allowlisted gems are used: `jekyll-feed`, `jekyll-sitemap`, `jekyll-paginate` (v1, not v2), `jekyll-seo-tag`. `jekyll-archives` is intentionally avoided (not allowlisted) — tag pages are instead handled manually via `_pages/tags.md` + `_layouts/tag-archive.html`.

## Architecture

Full details in [DOCS/ARCHITECTURE.md](DOCS/ARCHITECTURE.md) — read it for the design-token table and directory map. Key points:

- **Layout inheritance**: `_layouts/default.html` is the shell (`<head>`, header/footer includes) that everything else extends. `home.html` → post-card grid; `post.html` → article view with TOC, progress bar, share buttons, author card, prev/next nav, related posts; `tag-archive.html` for per-tag pages.
- **Sass**: `assets/css/style.scss` is the single entry point (`@import "blog-theme"`). `_sass/blog-theme.scss` is the orchestrator importing, in order, `base/` (variables, reset, typography) → `layout/` (`_home.scss`, `_post.scss`) → `components/` (header, footer, card, sidebar, darkmode, progress-bar, toc, share, search). When adding styles, add a partial under the right subfolder and import it from `blog-theme.scss` rather than inlining in an existing file.
- **JS is vanilla, no bundler** — each file in `assets/js/` is a standalone `DOMContentLoaded` (or scroll-listener) script loaded directly by layouts: `theme-toggle.js`, `tag-filter.js`, `copy-code.js`, `toc-scrollspy.js`, `reading-progress.js`, `search-setup.js` (drives `assets/js/vendor/simple-jekyll-search.min.js` against `search.json`, the generated post index).
- **Design tokens** live as CSS custom properties in `_sass/base/_variables.scss` (dark/light values for `--bg`, `--accent`, `--accent-2`, `--text`; fonts: Plus Jakarta Sans for display, Inter for body, JetBrains Mono for code/meta).
- **`_data/social.yml`** is the single source of truth for social links, consumed by `footer.html` and `share-buttons.html`.

## Adding a blog post

Create `_posts/YYYY-MM-DD-slug-title.md` with front matter:
```yaml
---
layout: post
title: "Your Post Title"
subtitle: "Optional one-sentence key insight"
date: YYYY-MM-DD
categories: ai python
tags: [Tag1, Tag2, Tutorial]
description: "Optional SEO/card excerpt"
cover_image: /assets/images/your-cover.jpg   # optional; falls back to gradient
---
```
`author` and `layout: post` are already defaulted for everything in `_posts/` via `_config.yml` scope defaults — don't repeat them unless overriding.

For structure, tone, and formatting conventions (canonical section outline, front-matter conventions, SVG/mermaid diagram embedding, table styles, cross-post linking pattern, references table), follow `.agents/skills/createblog/SKILL.md` — it encodes the established house style in detail and should be treated as authoritative for post-writing tasks.

## Workspace conventions (`.agents/AGENTS.md`)

- Use the project's `.venv` for any Python work (`pyscripts/`).
- After a development iteration, update [DOCS/ARCHITECTURE.md](DOCS/ARCHITECTURE.md) with any design/architecture changes, and [README.md](README.md) with any new user-facing features.
- After a completed phase of work, log it in `DOCS/PHASE_COMPLETION.md`.
