/**
 * reading-progress.js
 * Fills the #reading-progress bar as the user scrolls
 * through the article body.
 */

(function () {
  function init() {
    const bar     = document.getElementById('reading-progress');
    const article = document.querySelector('.post-content');
    const backTop = document.querySelector('.back-to-top');

    if (!bar || !article) return;

    function update() {
      const rect     = article.getBoundingClientRect();
      const total    = article.offsetHeight;
      const scrolled = Math.max(0, -rect.top);
      const pct      = Math.min(100, (scrolled / (total - window.innerHeight)) * 100);

      bar.style.width = pct + '%';

      // Back to top button
      if (backTop) {
        backTop.classList.toggle('visible', window.scrollY > 400);
      }
    }

    window.addEventListener('scroll', update, { passive: true });
    update();

    // Back to top button
    if (backTop) {
      backTop.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
