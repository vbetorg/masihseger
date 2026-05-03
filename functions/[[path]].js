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
        cf: {
          cacheTtl: 600,
          cacheEverything: true
        }
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
        </url>`;
      }).join("");

      return new Response(`<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url>
          <loc>${DOMAIN}/</loc>
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
    // HOMEPAGE
    // ======================
    if (!slug) {

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
        </a>`;
      });

      const totalPages = Math.ceil(data.length / perPage);

      let pagination = "";
      for (let i = 1; i <= totalPages; i++) {
        pagination += `<a href="/?page=${i}" class="${i === page ? "active" : ""}">${i}</a>`;
      }

      return new Response(`
      <html>
      <head>
        <title>Blog Artikel</title>
        <meta name="description" content="Kumpulan artikel terbaru">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">

        <style>
          body{margin:0;font-family:sans-serif;background:#f5f5f5;}
          header{background:#111;color:#fff;padding:20px;text-align:center;}
          .container{max-width:1100px;margin:auto;padding:20px;}
          .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:20px;}
          .card{background:#fff;padding:15px;border-radius:10px;text-decoration:none;color:#000;}
          .card img{width:100%;border-radius:8px;}
          .pagination{text-align:center;margin-top:20px;}
          .pagination a{margin:5px;padding:8px 12px;background:#ddd;text-decoration:none;}
          .pagination .active{background:#111;color:#fff;}
        </style>
      </head>

      <body>
        <header>
          <h1>Blog Artikel</h1>
        </header>

        <div class="container">
          <div class="grid">${cards}</div>
          <div class="pagination">${pagination}</div>
        </div>
      </body>
      </html>
      `, {
        headers: { "content-type": "text/html;charset=UTF-8" },
      });
    }

    // ======================
    // ARTIKEL
    // ======================
    const artikel = data.find(item => {
      const target = make(slug);
      return [make(item.slug), make(item.id), make(item.title)].includes(target);
    });

    if (!artikel) {
      return new Response("Not found", { status: 404 });
    }

    const title = artikel.title || "Artikel";
    const content = artikel.content || "";
    const desc = artikel.meta_description || content.substring(0, 140);

    const image = artikel.image && artikel.image.trim() !== ""
      ? artikel.image
      : "/default.png";

    const fullUrl = `${DOMAIN}/artikel/${slug}`;

    // related
    let related = "<h3>Artikel Terkait</h3><ul>";
    data.slice(0,5).forEach(item => {
      const s = makeSlug(item);
      related += `<li><a href="/artikel/${s}">${item.title}</a></li>`;
    });
    related += "</ul>";

    // JSON-LD
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": title,
      "description": desc,
      "image": image,
      "mainEntityOfPage": fullUrl
    };

    return new Response(`
    <html>
    <head>
      <title>${title}</title>

      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="description" content="${desc}">
      <link rel="canonical" href="${fullUrl}">

      <!-- OG -->
      <meta property="og:title" content="${title}">
      <meta property="og:description" content="${desc}">
      <meta property="og:image" content="${image}">

      <!-- JSON -->
      <script type="application/ld+json">
        ${JSON.stringify(jsonLd)}
      </script>

      <style>
        body{font-family:sans-serif;max-width:800px;margin:auto;padding:20px;}
      </style>
    </head>

    <body>
      <h1>${title}</h1>
      <p><i>${desc}</i></p>

      ${content}

      ${related}

      <br><a href="/">← Kembali</a>
    </body>
    </html>
    `, {
      headers: { "content-type": "text/html;charset=UTF-8" },
    });

  } catch (err) {
    return new Response("ERROR:\n" + err.toString());
  }
}
