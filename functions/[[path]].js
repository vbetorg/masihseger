export async function onRequest(context) {
  try {
    const request = context.request;
    const url = new URL(request.url);
    const path = url.pathname;

    const API_URL = "https://script.google.com/macros/s/AKfycbxXpn0lB80LpLRaJHKBI5wgLjnyGLU-gXC3qTo-MxXBuJlHbTZ10ORuFdnDRl1LB2y5/exec";
    const DOMAIN = url.origin;

    const page = parseInt(url.searchParams.get("page") || "1");
    const perPage = 12;

    const cache = caches.default;

    // ======================
    // FETCH API (CACHE)
    // ======================
    const cacheKey = new Request(API_URL);
    let res = await cache.match(cacheKey);

    if (!res) {
      res = await fetch(API_URL, {
        cf: { cacheTtl: 600, cacheEverything: true }
      });
      await cache.put(cacheKey, res.clone());
    }

    const text = await res.text();

    let data;
    try {
      data = JSON.parse(text);
      if (!Array.isArray(data)) data = [];
    } catch {
      return new Response("Bukan JSON:\n" + text);
    }

    // ======================
    // SLUG HELPER
    // ======================
    const make = (val) =>
      (val || "")
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^\w\-]+/g, "");

    const makeSlug = (item) => make(item.slug || item.id || item.title);

    // ======================
    // SITEMAP
    // ======================
    if (path === "/sitemap.xml") {
      const today = new Date().toISOString();

      const items = data.map(item => {
        const s = makeSlug(item);
        return `
          <url>
            <loc>${DOMAIN}/artikel/${s}</loc>
            <lastmod>${today}</lastmod>
            <changefreq>daily</changefreq>
            <priority>0.8</priority>
          </url>
        `;
      }).join("");

      return new Response(`<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url>
          <loc>${DOMAIN}/</loc>
          <lastmod>${today}</lastmod>
          <priority>1.0</priority>
        </url>
        ${items}
      </urlset>`, {
        headers: { "content-type": "application/xml" },
      });
    }

    // ======================
    // ROUTING
    // ======================
    const match = path.match(/^\/artikel\/(.+)$/);
    const slug = match ? decodeURIComponent(match[1]) : null;

    // ======================
    // LOAD TEMPLATE (CACHE)
    // ======================
    async function loadTemplate(file) {
      const req = new Request(url.origin + file);
      let res = await cache.match(req);

      if (!res) {
        res = await fetch(req);
        await cache.put(req, res.clone());
      }

      return await res.text();
    }

    // ======================
    // HOMEPAGE
    // ======================
    if (!slug) {

      const template = await loadTemplate("/templates/home.html");

      const start = (page - 1) * perPage;
      const paginated = data.slice(start, start + perPage);

      let cards = "";

      paginated.forEach(item => {
        const s = makeSlug(item);
        const title = item.title || "Artikel";
        const desc = (item.meta_description || "").substring(0, 100);

        const image = item.image && item.image.trim() !== ""
          ? item.image
          : "/default.png";

        cards += `
          <a href="/artikel/${s}" class="card">
            <img src="${image}" alt="${title}">
            <h2>${title}</h2>
            <p>${desc}</p>
          </a>
        `;
      });

      const totalPages = Math.ceil(data.length / perPage);

      let pagination = "";
      for (let i = 1; i <= totalPages; i++) {
        pagination += `<a href="/?page=${i}" class="${i === page ? "active" : ""}">${i}</a>`;
      }

      const jsonLd = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": "Website Kamu",
        "url": DOMAIN
      };

      let html = template
        .replace(/{{title}}/g, "Blog Artikel")
        .replace(/{{desc}}/g, "Kumpulan artikel terbaru")
        .replace(/{{url}}/g, `${DOMAIN}/?page=${page}`)
        .replace(/{{site_name}}/g, "Website Kamu")
        .replace(/{{author}}/g, "Admin")
        .replace(/{{image}}/g, "/default.png")
        .replace("{{json}}", JSON.stringify(jsonLd))
        .replace("{{cards}}", cards)
        .replace("{{pagination}}", pagination);

      return new Response(html, {
        headers: { "content-type": "text/html;charset=UTF-8" },
      });
    }

    // ======================
    // ARTIKEL (ANTI ERROR)
    // ======================
    const artikel = data.find(item => {
      const target = make(slug);

      const candidates = [
        make(item.slug),
        make(item.id),
        make(item.title),
      ];

      return candidates.includes(target);
    });

    if (!artikel) {
      return new Response("Slug tidak ditemukan: " + slug, { status: 404 });
    }

    const template = await loadTemplate("/templates/artikel.html");

    const title = artikel.title || "Artikel";
    const content = artikel.content || "";
    const desc = artikel.meta_description || content.substring(0, 140);

    const image = artikel.image && artikel.image.trim() !== ""
      ? artikel.image
      : "/default.png";

    const fullUrl = `${DOMAIN}/artikel/${slug}`;

    // ======================
    // RELATED
    // ======================
    let related = "<h3>Artikel Terkait</h3><ul>";

    data.slice(0, 5).forEach(item => {
      const s = makeSlug(item);
      related += `<li><a href="/artikel/${s}">${item.title}</a></li>`;
    });

    related += "</ul>";

    // ======================
    // JSON-LD
    // ======================
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": title,
      "description": desc,
      "image": image,
      "mainEntityOfPage": fullUrl,
      "author": {
        "@type": "Person",
        "name": "Admin"
      },
      "publisher": {
        "@type": "Organization",
        "name": "Website Kamu"
      },
      "datePublished": new Date().toISOString()
    };

    let html = template
      .replace(/{{title}}/g, title)
      .replace(/{{desc}}/g, desc)
      .replace(/{{image}}/g, image)
      .replace(/{{url}}/g, fullUrl)
      .replace(/{{site_name}}/g, "Website Kamu")
      .replace(/{{author}}/g, "Admin")
      .replace("{{json}}", JSON.stringify(jsonLd))
      .replace("{{content}}", content)
      .replace("{{related}}", related);

    return new Response(html, {
      headers: { "content-type": "text/html;charset=UTF-8" },
    });

  } catch (err) {
    return new Response("ERROR:\n" + err.toString());
  }
}
