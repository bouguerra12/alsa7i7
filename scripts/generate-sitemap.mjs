import fs from 'fs'
import path from 'path'

const SITE_URL = 'https://alsa7i7.com'
const INDEX_PATH = path.resolve('public/data/bukhari/index_min.json')
const OUT_PATH = path.resolve('public/sitemap.xml')

if (!fs.existsSync(INDEX_PATH)) {
  console.error('❌ index_min.json introuvable')
  process.exit(1)
}

const data = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8'))

const urls = data.map(h => `
  <url>
    <loc>${SITE_URL}/bukhari/${h.id}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
`).join('')

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${SITE_URL}/bukhari</loc>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  ${urls}
</urlset>
`

fs.writeFileSync(OUT_PATH, sitemap.trim())
console.log(`✅ sitemap.xml généré (${data.length} hadiths)`)
