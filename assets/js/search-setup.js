document.addEventListener('DOMContentLoaded', function() {
  const searchModal = document.getElementById('search-modal');
  const searchInput = document.getElementById('search-input');
  const resultsContainer = document.getElementById('results-container');
  const searchToggle = document.getElementById('nav-search');
  const closeBtn = document.getElementById('search-modal-close');
  const backdrop = document.getElementById('search-modal-backdrop');

  if (!searchModal || !searchInput || !resultsContainer || !searchToggle) return;

  // Toggle modal open
  function openModal() {
    searchModal.classList.add('is-active');
    searchModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden'; // Prevent scrolling underlying page
    setTimeout(() => {
      searchInput.focus();
    }, 100);
  }

  // Toggle modal close
  function closeModal() {
    searchModal.classList.remove('is-active');
    searchModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = ''; // Restore scrolling
    searchInput.value = '';
    resultsContainer.innerHTML = '';
  }

  // Event Listeners
  searchToggle.addEventListener('click', function(e) {
    e.preventDefault();
    openModal();
  });

  closeBtn.addEventListener('click', closeModal);
  backdrop.addEventListener('click', closeModal);

  // Close on Escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && searchModal.classList.contains('is-active')) {
      closeModal();
    }
  });

  // Initialize Simple-Jekyll-Search
  if (typeof SimpleJekyllSearch === 'function') {
    SimpleJekyllSearch({
      searchInput: searchInput,
      resultsContainer: resultsContainer,
      json: searchToggle.getAttribute('data-search-json') || '/my-blog/search.json',
      searchResultTemplate: `
        <li class="search-result-item">
          <a href="{url}" class="search-result-link">
            <div class="search-result-header">
              <span class="search-result-title">{title}</span>
              <span class="search-result-date">{date}</span>
            </div>
            <p class="search-result-excerpt">{excerpt}</p>
            <div class="search-result-tags">
              {tags}
            </div>
          </a>
        </li>
      `,
      noResultsText: '<li class="search-no-results">No matching posts found.</li>',
      limit: 8,
      fuzzy: true
    });
  }
});
