/**
 * tag-filter.js
 * Client-side tag filter chips on the home page.
 * No page reload — filters post cards by data-post-tags attribute.
 */

(function () {
  function init() {
    const chips = document.querySelectorAll('[data-tag-filter]');
    const cards = document.querySelectorAll('[data-post-tags]');
    if (!chips.length) return;

    chips.forEach((chip) => {
      chip.addEventListener('click', () => {
        const tag = chip.dataset.tagFilter;

        // Update active chip
        chips.forEach((c) => {
          c.classList.remove('active');
          c.setAttribute('aria-pressed', 'false');
        });
        chip.classList.add('active');
        chip.setAttribute('aria-pressed', 'true');

        // Filter cards
        let shown = 0;
        cards.forEach((card) => {
          const tags = (card.dataset.postTags || '').split(',').map((t) => t.trim().toLowerCase());
          const match = tag === 'all' || tags.includes(tag.toLowerCase());
          card.style.display = match ? '' : 'none';
          if (match) shown++;
        });

        // Update count
        const countEl = document.getElementById('posts-shown-count');
        if (countEl) {
          countEl.textContent = tag === 'all' ? cards.length : shown;
        }
      });
    });

    // Set initial aria-pressed
    const allChip = document.querySelector('[data-tag-filter="all"]');
    if (allChip) {
      allChip.classList.add('active');
      allChip.setAttribute('aria-pressed', 'true');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
