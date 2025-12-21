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

if (!Array.isArray(data)) {
  console.error('❌ index_min.json invalide (pas un tableau)')
  process.exit(1)
}

// ✅ Canonical URLs uniquement : /bukhari/<uid>
const urls = data
  .map((h) => {
    const slug = h?.uid ?? null
    if (!slug) return null

    return `
  <url>
    <loc>${SITE_URL}/bukhari/${slug}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`
  })
  .filter(Boolean)
  .join('')

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
console.log(`✅ sitemap.xml généré (${data.length} hadiths, URLs canoniques uniquement)`)
