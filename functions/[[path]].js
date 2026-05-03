export async function onRequest(context) {
  try {
    const url = new URL(context.request.url);
    const path = url.pathname;
    const DOMAIN = url.origin;

    const API_URL = "https://script.google.com/macros/s/AKfycbxXpn0lB80LpLRaJHKBI5wgLjnyGLU-gXC3qTo-MxXBuJlHbTZ10ORuFdnDRl1LB2y5/exec";

    const match = path.match(/^\/artikel\/(.+)$/);
    const slug = match ? match[1] : null;

    const page = parseInt(url.searchParams.get("page") || "1");
    const perPage = 12;

    // ======================
    // SAFE HELPERS
    // ======================
    const makeSlug = (str) =>
      (str || "")
        .toString()
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");

    const escapeHtml = (str) =>
      (str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    // ======================
    // FETCH (WITH TIMEOUT)
    // ======================
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    let data = [];

    try {
      const res = await fetch(API_URL, { signal: controller.signal });
      clearTimeout(timeout);

      const text = await res.text();

      try {
        const json = JSON.parse(text);
        if (Array.isArray(json)) data = json;
      } catch {
        return new Response("API bukan JSON", { status: 500 });
      }
    } catch (err) {
      return new Response("Gagal fetch API", { status: 500 });
    }

    // ======================
    // SITEMAP
    // ======================
    if (path === "/sitemap.xml") {
      const items = data.map(item => {
        const s = makeSlug(item.slug || item.id);
        return `<url><loc>${DOMAIN}/artikel/${s}</loc></url>`;
      }).join("");

      return new Response(`<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>${DOMAIN}/</loc></url>
        ${items}
      </urlset>`, {
        headers: { "content-type": "application/xml" },
      });
    }

    // ======================
    // HOMEPAGE
    // ======================
    if (!slug) {

      const start = (page - 1) * perPage;
      const paginated = data.slice(start, start + perPage);

      let cards = "";

      paginated.forEach(item => {
        const s = makeSlug(item.slug || item.id);
        const title = escapeHtml(item.title || "Artikel");
        const desc = escapeHtml((item.meta_description || "").substring(0, 120));

        const image = item.image && item.image.trim() !== ""
          ? item.image
          : "/default.png";

        cards += `
          <a href="/artikel/${s}" class="card">
            <img src="${image}" alt="${title}" loading="lazy">
            <h2>${title}</h2>
            <p>${desc}</p>
          </a>
        `;
      });

      const totalPages = Math.ceil(data.length / perPage);

      let pagination = `<div class="pagination">`;

      if (page > 1) {
        pagination += `<a href="/?page=${page - 1}">Prev</a>`;
      }

      for (let i = 1; i <= totalPages; i++) {
        pagination += `<a href="/?page=${i}" class="${i === page ? 'active' : ''}">${i}</a>`;
      }

      if (page < totalPages) {
        pagination += `<a href="/?page=${page + 1}">Next</a>`;
      }

      pagination += `</div>`;

      return new Response(`
      <html>
      <head>
        <title>Blog Artikel - Page ${page}</title>

        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">

        <meta name="description" content="Kumpulan artikel terbaru halaman ${page}">
        <meta name="robots" content="index, follow">

        <link rel="canonical" href="${DOMAIN}/?page=${page}">
        <link rel="sitemap" href="/sitemap.xml">

        ${page > 1 ? `<link rel="prev" href="/?page=${page - 1}">` : ""}
        ${page < totalPages ? `<link rel="next" href="/?page=${page + 1}">` : ""}

        <style>
          body {margin:0;font-family:sans-serif;background:#f5f5f5;}
          header {background:#111;color:#fff;padding:20px;text-align:center;}
          .container {max-width:1100px;margin:auto;padding:20px;}
          .grid {
            display:grid;
            grid-template-columns:repeat(auto-fill,minmax(250px,1fr));
            gap:20px;
          }
          .card {
            background:#fff;
            border-radius:10px;
            padding:15px;
            text-decoration:none;
            color:#000;
          }
          .card img {width:100%;border-radius:8px;}
          .pagination {text-align:center;margin-top:20px;}
          .pagination a {margin:5px;text-decoration:none;}
          .active {font-weight:bold;}
        </style>
      </head>

      <body>
        <header><h1>Blog Artikel</h1></header>

        <div class="container">
          <div class="grid">${cards}</div>
          ${pagination}
        </div>
      </body>
      </html>
      `, {
        headers: {
          "content-type": "text/html;charset=UTF-8",
          "cache-control": "public, max-age=300"
        },
      });
    }

    // ======================
    // ARTIKEL
    // ======================
    const artikel = data.find(item => {
      const s = makeSlug(item.slug || item.id);
      return s === slug;
    });

    if (!artikel) {
      return new Response("Not found", { status: 404 });
    }

    const title = escapeHtml(artikel.title || "Artikel");
    const desc = escapeHtml(
      artikel.meta_description || (artikel.content || "").substring(0, 140)
    );

    const content = artikel.content || "";

    const image = artikel.image && artikel.image.trim() !== ""
      ? artikel.image
      : "/default.png";

    const fullUrl = `${DOMAIN}/artikel/${slug}`;

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
      <meta name="robots" content="index, follow">

      <link rel="canonical" href="${fullUrl}">
      <link rel="sitemap" href="/sitemap.xml">

      <meta property="og:title" content="${title}">
      <meta property="og:description" content="${desc}">
      <meta property="og:image" content="${image}">
      <meta property="og:type" content="article">

      <script type="application/ld+json">
        ${JSON.stringify(jsonLd)}
      </script>

      <style>
        body {font-family:sans-serif;max-width:800px;margin:auto;padding:20px;}
        img {width:100%;border-radius:10px;}
      </style>
    </head>

    <body>

      <img src="${image}" alt="${title}" loading="lazy">

      <h1>${title}</h1>
      <p><i>${desc}</i></p>

      ${content}

      <br><a href="/">← Kembali</a>

    </body>
    </html>
    `, {
      headers: {
        "content-type": "text/html;charset=UTF-8",
        "cache-control": "public, max-age=300"
      },
    });

  } catch (err) {
    return new Response("ERROR:\n" + err.toString(), { status: 500 });
  }
}
