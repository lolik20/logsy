import fs from "node:fs";
import { SEO_PAGES } from "../src/lib/seo/registry";
fs.writeFileSync(process.argv[2], JSON.stringify(SEO_PAGES.map((p) => ({ url: p.url, title: p.title, h1: p.h1, keywords: p.keywords, description: p.description })), null, 1));
console.log("pages:", SEO_PAGES.length);
