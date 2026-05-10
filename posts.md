---
layout: default
title: Posts
permalink: /posts/
---

<section class="posts-section" style="padding-top: 4rem; padding-bottom: 4rem;">
  <div class="container">
    <div class="posts-header">
      <span class="posts-label">All Posts</span>
      <span class="posts-count">{{ site.posts | size }} entries</span>
    </div>
    <div class="posts-grid">
      {% for post in site.posts %}
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
