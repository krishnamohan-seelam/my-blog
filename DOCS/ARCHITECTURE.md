# Architecture — my-blog

## Stack
- **Jekyll 4.4.1** on GitHub Pages
- **Theme base**: `minima` 2.5 (heavily overridden)
- **Markdown**: kramdown + Rouge syntax highlighting
- **CSS**: Dart Sass via `jekyll-sass-converter`
- **Fonts**: Google Fonts (Instrument Serif, DM Mono, DM Sans)
- **Plugins**: `jekyll-feed`, `jekyll-sitemap`, `jekyll-paginate` (v1), `jekyll-seo-tag`

---

## Directory Structure

```
_layouts/
  default.html        # Global shell: <head>, header include, footer include
  home.html           # Two-column home: post list + sidebar
  post.html           # Article layout: TOC, progress bar, share, nav, related
  page.html           # Static pages (About, Contact)
  tag-archive.html    # Tag archive page

_includes/
  header.html              # Sticky nav with logo, links, RSS, dark-mode toggle
  footer.html              # Social links + copyright
  seo-head.html            # Open Graph, Twitter Card, JSON-LD
  sidebar-profile.html     # Avatar, bio, social icons, popular tags
  post-card.html           # Post list card (title, excerpt, meta, NEW badge)
  post-meta.html           # Reusable date · reading-time · tags row
  toc.html                 # TOC containers (populated by JS)
  share-buttons.html       # Twitter/X, LinkedIn, copy-link
  post-nav.html            # Prev/next post navigation
  related-posts.html       # 2-3 related posts by shared tag

_sass/
  blog-theme.scss          # Orchestrator — imports all partials in order
  base/
    _variables.scss        # CSS custom properties, spacing scale, breakpoints
    _reset.scss            # Base reset, .skip-link, .container, .tag-pill
    _typography.scss       # Article body typography (18px, 1.82 line-height)
  layout/
    _home.scss             # Two-column grid, tag filter, pagination
    _post.scss             # Article hero, body+TOC grid, author card, related
  components/
    _header.scss           # Sticky header with blur, nav links, hamburger
    _footer.scss           # Footer layout
    _card.scss             # Post card component
    _sidebar.scss          # Sidebar profile, sticky positioning
    _darkmode.scss         # Theme toggle icon swap
    _progress-bar.scss     # Reading progress bar
    _toc.scss              # Desktop sticky TOC + mobile collapsible
    _share.scss            # Share buttons, copy-code, post nav, back-to-top

assets/
  css/style.scss           # Entry point: @import "blog-theme"
  images/avatar.jpg        # Profile photo
  js/
    theme-toggle.js        # Dark/light toggle + mobile hamburger
    tag-filter.js          # Client-side tag filtering on home page
    copy-code.js           # Copy button for code blocks
    toc-scrollspy.js       # Dynamic TOC generator & IntersectionObserver highlight
    reading-progress.js    # Scroll-based progress bar

_data/
  social.yml               # Social links (single source of truth)

_pages/
  about.md                 # About page
  tags.md                  # All-tags index
  404.md                   # Custom 404

_posts/                    # Content (unchanged front matter)
```

---

## Design System

| Token | Dark | Light |
|---|---|---|
| `--bg` | `#0d0d0d` | `#ffffff` |
| `--accent` | `#6ee7b7` | `#059669` |
| `--text` | `#e8e4dc` | `#111827` |
| `--font-serif` | Instrument Serif | same |
| `--font-mono` | DM Mono | same |
| `--container-wide` | 1100px | same |
| `--content-width` | 680px | same |
| `--sidebar-width` | 268px | same |

---

## Layouts — Data Flow

```
index.md (layout: home)
  └── home.html (layout: default)
        ├── default.html (<head>, header, footer)
        ├── post-card.html (per post)
        └── sidebar-profile.html

_posts/*.md (layout: post)
  └── post.html (layout: default)
        ├── default.html
        ├── toc.html
        ├── share-buttons.html
        ├── post-nav.html
        └── related-posts.html
```

---

## JavaScript

| File | Trigger | Behavior |
|---|---|---|
| `theme-toggle.js` | `DOMContentLoaded` | Toggle light/dark, persist localStorage, hamburger |
| `tag-filter.js` | `DOMContentLoaded` | Filter post cards by `data-post-tags` |
| `copy-code.js` | `DOMContentLoaded` | Inject copy buttons into all `<pre>` blocks |
| `toc-scrollspy.js` | `DOMContentLoaded` | Dynamically generates TOC links from `h2`/`h3` headings and uses IntersectionObserver to highlight active TOC link |
| `reading-progress.js` | `scroll` (passive) | Update progress bar width, show/hide back-to-top |

---

## GitHub Pages Compatibility

Only allowlisted gems used:
- `jekyll-paginate` ✅ (v1)
- `jekyll-seo-tag` ✅
- `jekyll-feed` ✅
- `jekyll-sitemap` ✅

`jekyll-archives` is **not** used (not allowlisted). Tag pages are handled by `_pages/tags.md` (all-tags) and `_layouts/tag-archive.html` (manual per-tag pages).

### CI/CD and Platform Compatibility
To support building on local Windows environments and deploying on GitHub Actions runner (`ubuntu-latest`), the `Gemfile.lock` includes platform definitions for:
- `x64-mingw-ucrt` (Local Windows development)
- `x86_64-linux` (GitHub Actions workflow runner)
- `ruby` (Generic fallback)

If the lockfile goes out of sync with new platforms, add platforms using:
```bash
bundle lock --add-platform x86_64-linux
bundle lock --add-platform ruby
```
