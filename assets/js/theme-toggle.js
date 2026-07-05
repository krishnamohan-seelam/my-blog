/**
 * theme-toggle.js
 * Dark/Light mode persistence via localStorage.
 * Extracted from inline script in default.html.
 * Loaded deferred — DOM must exist before this runs.
 */

(function () {
  const STORAGE_KEY = 'theme';

  function getSystemTheme() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }

  // Toggle button click
  const toggleBtn = document.getElementById('theme-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || getSystemTheme();
      applyTheme(current === 'light' ? 'dark' : 'light');
    });

    // Set aria-label dynamically
    const observer = new MutationObserver(() => {
      const theme = document.documentElement.getAttribute('data-theme') || getSystemTheme();
      toggleBtn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  // Mobile nav hamburger
  const hamburger = document.getElementById('nav-hamburger');
  const navLinks  = document.getElementById('nav-links');
  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      const isOpen = navLinks.classList.toggle('nav-links--mobile-open');
      hamburger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  }
})();
