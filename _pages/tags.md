---
layout: default
title: "All Tags"
permalink: /tags/
---

<div class="container" style="padding-top: 3rem; padding-bottom: 4rem;">

  <div style="margin-bottom: 3rem; border-bottom: 0.5px solid var(--border); padding-bottom: 1.5rem;">
    <p class="posts-label">Browse</p>
    <h1 class="post-hero__title" style="font-size: clamp(28px, 4vw, 38px); margin-top: 0.5rem; margin-bottom: 0;">All Tags</h1>
  </div>

  {% assign all_tags = site.posts | map: 'tags' | join: ',' | split: ',' | uniq | sort %}

  <div style="display: flex; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 3rem;">
    {% for tag in all_tags %}
      {% assign tag_stripped = tag | strip %}
      {% if tag_stripped != '' %}
        {% assign tag_count = 0 %}
        {% for post in site.posts %}
          {% if post.tags contains tag_stripped %}
            {% assign tag_count = tag_count | plus: 1 %}
          {% endif %}
        {% endfor %}
        <a href="#tag-{{ tag_stripped | downcase | replace: ' ', '-' }}"
           class="tag-pill"
           style="font-size: 13px; padding: 6px 14px;">
          {{ tag_stripped }}
          <span style="opacity: 0.6; margin-left: 4px;">({{ tag_count }})</span>
        </a>
      {% endif %}
    {% endfor %}
  </div>

  {% for tag in all_tags %}
    {% assign tag_stripped = tag | strip %}
    {% if tag_stripped != '' %}
      {% assign tag_posts = site.posts | where_exp: "p", "p.tags contains tag_stripped" %}
      {% if tag_posts.size > 0 %}

  <section id="tag-{{ tag_stripped | downcase | replace: ' ', '-' }}"
           style="margin-bottom: 3rem;">
    <h2 style="font-family: var(--font-mono); font-size: 13px; color: var(--accent); letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 1rem; border-bottom: 0.5px solid var(--border); padding-bottom: 0.75rem;">
      #{{ tag_stripped }}
      <span style="color: var(--text-dim); font-size: 11px;">({{ tag_posts.size }})</span>
    </h2>
    <div class="post-list">
      {% for post in tag_posts %}
        {% include post-card.html post=post %}
      {% endfor %}
    </div>
  </section>

      {% endif %}
    {% endif %}
  {% endfor %}

</div>
