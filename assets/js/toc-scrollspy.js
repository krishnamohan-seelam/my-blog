/**
 * toc-scrollspy.js
 * Uses IntersectionObserver to highlight the active TOC section
 * as the user scrolls through the article.
 */

(function () {
  function init() {
    const headings = Array.from(
      document.querySelectorAll('.post-content h2, .post-content h3')
    );
    if (!headings.length) return;

    const desktopList = document.getElementById('toc-list-desktop');
    const mobileList = document.getElementById('toc-list-mobile');

    // Populate TOC lists dynamically from article headings
    if (desktopList || mobileList) {
      headings.forEach((heading) => {
        // Ensure the heading has an ID
        if (!heading.id) {
          heading.id = heading.textContent
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
        }

        const isH3 = heading.tagName.toLowerCase() === 'h3';
        const text = heading.textContent.trim();

        const createLink = () => {
          const li = document.createElement('li');
          const a = document.createElement('a');
          a.href = `#${heading.id}`;
          a.className = 'toc-link' + (isH3 ? ' toc-link--h3' : '');
          a.textContent = text;
          li.appendChild(a);
          return li;
        };

        if (desktopList) {
          desktopList.appendChild(createLink());
        }
        if (mobileList) {
          mobileList.appendChild(createLink());
        }
      });
    }

    const tocLinks = document.querySelectorAll('.toc-link');
    if (!tocLinks.length) return;

    // Build id → toc-link map (supporting multiple links per ID, e.g. desktop + mobile)
    const linkMap = {};
    tocLinks.forEach((link) => {
      const href = link.getAttribute('href');
      if (href && href.startsWith('#')) {
        const id = decodeURIComponent(href.slice(1));
        if (!linkMap[id]) {
          linkMap[id] = [];
        }
        linkMap[id].push(link);
      }
    });

    let activeId = null;

    function setActive(id) {
      if (id === activeId) return;
      activeId = id;
      tocLinks.forEach((l) => l.classList.remove('active'));
      if (linkMap[id]) {
        linkMap[id].forEach((link) => link.classList.add('active'));
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the topmost visible heading
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible.length) {
          setActive(visible[0].target.id);
        }
      },
      {
        rootMargin: '-80px 0px -65% 0px',
        threshold: 0,
      }
    );

    headings.forEach((h) => {
      if (h.id) observer.observe(h);
    });

    // Mobile TOC toggle
    const mobileToggle = document.querySelector('.toc-mobile__toggle');
    const mobileContent = document.querySelector('.toc-mobile__content');
    if (mobileToggle && mobileContent) {
      mobileToggle.addEventListener('click', () => {
        const isOpen = mobileContent.classList.toggle('open');
        mobileToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
