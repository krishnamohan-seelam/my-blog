---
layout: home
title: Home
---
 
<section class="hero">
 <div class="container">
  <h1>Krishna's Blog</h1>
  <p class="tagline">Collections of my learnings on databases, agents, and developer tooling.</p>
  <p><a class="cta" href="#posts">Read latest posts</a></p>
 </div>
</section>

<section id="posts" class="posts-grid container">
 {% for post in site.posts limit:6 %}
 <article class="card">
  <a href="{{ post.url | relative_url }}">
   <h3>{{ post.title }}</h3>
   <p class="excerpt">{{ post.excerpt | strip_html | truncate:120 }}</p>
   <time datetime="{{ post.date | date_to_xmlschema }}">{{ post.date | date: "%b %-d, %Y" }}</time>
  </a>
 </article>
 {% endfor %}
</section>

<section class="about container">
 <h2>About</h2>
 <p>I write short tutorials and walkthroughs focused on practical developer tooling and data engineering topics.</p>
</section>
