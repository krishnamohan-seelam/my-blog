---
layout: default
title: Home
---

<section class="hero">
  <div class="container">
    <p class="hero-tag">// Technical writing</p>
    <h1 class="hero-title">Developer tooling for AI agents</h1>
    <p class="hero-desc">Collections of my learnings on building with Gen AI — practical tutorials, walkthroughs, and deep dives.</p>
    <a class="cta" href="#posts">Read latest posts →</a>
  </div>
</section>

<section id="posts" class="posts-section">
  <div class="container">
    <div class="posts-header">
      <span class="posts-label">Latest posts</span>
      <span class="posts-count">{{ site.posts | size }} entries</span>
    </div>
    <div class="posts-grid">
      {% for post in site.posts limit:6 %}
      <article class="post-card">
        <a href="{{ post.url | relative_url }}">
          <div class="post-meta">
            <time datetime="{{ post.date | date_to_xmlschema }}">{{ post.date | date: "%b %-d, %Y" }}</time>
            {% if post.tags.first %}<span class="post-tag">{{ post.tags.first }}</span>{% endif %}
          </div>
          <h3>{{ post.title }}</h3>
        </a>
      </article>
      {% endfor %}
    </div>
  </div>
</section>

<section id="about" class="about-section">
  <div class="container about-inner">
    <span class="about-label">About</span>
    <a href="https://github.com/krishnamohan-seelam/" target="_blank" rel="noopener noreferrer">Krishna Mohan Seelam</a>
    <p class="about-text">I’m currently exploring how to design and build AI agents, and I share my journey here—covering LLMs, agentic AI systems, developer tooling, databases, and practical ways to integrate them into building intelligent agents</p>
  </div>
</section>
