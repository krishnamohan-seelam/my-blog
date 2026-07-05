/**
 * toc-scrollspy.js
 * Uses IntersectionObserver to highlight the active TOC section
 * as the user scrolls through the article.
 */

(function () {
  function init() {
    const tocLinks = document.querySelectorAll('.toc-link');
    if (!tocLinks.length) return;

    const headings = Array.from(
      document.querySelectorAll('.post-content h2, .post-content h3')
    );
    if (!headings.length) return;

    // Build id → toc-link map
    const linkMap = {};
    tocLinks.forEach((link) => {
      const id = decodeURIComponent(link.getAttribute('href').slice(1));
      linkMap[id] = link;
    });

    let activeId = null;

    function setActive(id) {
      if (id === activeId) return;
      activeId = id;
      tocLinks.forEach((l) => l.classList.remove('active'));
      if (linkMap[id]) linkMap[id].classList.add('active');
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
