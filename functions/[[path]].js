export async function onRequest(context) {
  try {
    const request = context.request;
    const url = new URL(request.url);
    const path = url.pathname;

    const API_URL = "https://script.google.com/macros/s/AKfycbxXpn0lB80LpLRaJHKBI5wgLjnyGLU-gXC3qTo-MxXBuJlHbTZ10ORuFdnDRl1LB2y5/exec";
    const DOMAIN = url.origin;

    const match = path.match(/^\/artikel\/(.+)$/);
    const slug = match ? match[1] : null;

    const page = parseInt(url.searchParams.get("page") || "1");
    const perPage = 12;

    // ======================
    // FETCH DATA
    // ======================
    const res = await fetch(API_URL);
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
    const makeSlug = (val) =>
      (val || "")
        .toString()
        .toLowerCase()
        .replace(/\s+/g, "-");

    // ======================
    // LOAD TEMPLATE
    // ======================
    async function loadTemplate(path) {
      const res = await fetch(new URL(path, request.url));
      return await res.text();
    }

    // ======================
    // SITEMAP
    // ======================
    if (path === "/sitemap.xml") {
      const items = data.map(item => {
        const s = makeSlug(item.slug || item.id || item.title);
        return `<url><loc>${DOMAIN}/artikel/${s}</loc></url>`;
      }).join("");

      return new Response(`<?xml version="1.0"?>
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

      const template = await loadTemplate("/templates/home.html");

      const start = (page - 1) * perPage;
      const paginated = data.slice(start, start + perPage);

      let cards = "";

      paginated.forEach(item => {
        const s = makeSlug(item.slug || item.id || item.title);
        const title = item.title || "Artikel";
        const desc = (item.meta_description || "").substring(0, 100);
        const image = item.image || "/default.png";

        cards += `
        <a href="/artikel/${s}" class="card">
          <img src="${image}" alt="${title}" loading="lazy">
          <h2>${title}</h2>
          <p>${desc}</p>
        </a>`;
      });

      const totalPages = Math.ceil(data.length / perPage);

      let pagination = "";
      for (let i = 1; i <= totalPages; i++) {
        pagination += `<a href="/?page=${i}" class="${i === page ? "active" : ""}">${i}</a>`;
      }

      let html = template
        .replace(/{{title}}/g, "Blog Artikel")
        .replace(/{{desc}}/g, "Kumpulan artikel terbaru")
        .replace("{{cards}}", cards)
        .replace("{{pagination}}", pagination);

      return new Response(html, {
        headers: { "content-type": "text/html;charset=UTF-8" },
      });
    }

    // ======================
    // ARTIKEL
    // ======================
    const artikel = data.find(item => {
      const s = makeSlug(item.slug || item.id || item.title);
      return s === slug;
    });

    if (!artikel) {
      return new Response("Not found", { status: 404 });
    }

    const template = await loadTemplate("/templates/artikel.html");

    const title = artikel.title;
    const content = artikel.content || "";
    const desc = artikel.meta_description || content.substring(0, 140);
    const image = artikel.image || "/default.png";

    const fullUrl = `${DOMAIN}/artikel/${slug}`;

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": title,
      "description": desc,
      "image": image,
      "mainEntityOfPage": fullUrl
    };

    let html = template
      .replace(/{{title}}/g, title)
      .replace(/{{desc}}/g, desc)
      .replace(/{{image}}/g, image)
      .replace(/{{url}}/g, fullUrl)
      .replace("{{json}}", JSON.stringify(jsonLd))
      .replace("{{content}}", content);

    return new Response(html, {
      headers: { "content-type": "text/html;charset=UTF-8" },
    });

  } catch (err) {
    return new Response("ERROR:\n" + err.toString());
  }
}
