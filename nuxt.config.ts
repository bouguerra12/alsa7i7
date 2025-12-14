import { defineNuxtConfig } from 'nuxt/config'
import fs from 'fs'
import path from 'path'

export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: true },

  // ✅ Modules (ajout google-gtag)
  modules: ['@nuxtjs/tailwindcss', '@nuxtjs/google-gtag'],

  // ✅ GA4 (Google Analytics)
  gtag: {
    id: 'G-P7J0S59D58',
    config: {
      anonymize_ip: true,
      send_page_view: true
    }
  },

  // --- SEO CONFIGURATION (Generate Static Routes) ---
  hooks: {
    async 'nitro:config'(nitroConfig) {
      // Only run this during generation (npm run generate)
      if (nitroConfig.dev) return

      try {
        // 🔥 CORRECT PATH: public/data/bukhari/index_min.json
        const filePath = path.resolve(__dirname, 'public/data/bukhari/index_min.json')

        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8')
          const data = JSON.parse(content)

          // Generate routes for all hadiths found in the index
          const routes = data.map((h: any) => `/bukhari/${h.id}`)

          // Add these routes to Nitro prerender config
          if (!nitroConfig.prerender) nitroConfig.prerender = {}
          if (!nitroConfig.prerender.routes) nitroConfig.prerender.routes = []

          nitroConfig.prerender.routes.push(...routes)

          console.log(`✅ SEO: Added ${routes.length} Bukhari hadith pages to generation queue.`)
        } else {
          console.warn(
            "⚠️ Warning: public/data/bukhari/index_min.json not found. Did you run the Python script?"
          )
        }
      } catch (e) {
        console.error('⚠️ Error reading index_min.json for SEO:', e)
      }
    }
  },
  // ---------------------------------------------------------

  app: {
    head: {
      htmlAttrs: { lang: 'ar', dir: 'rtl' },
      title: 'Al-Sahih - صحيح البخاري',
      meta: [
        { name: 'description', content: 'البحث في صحيح البخاري بدقة وسرعة مع الشرح.' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { charset: 'utf-8' }
      ],
      link: [{ rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }]
    }
  }
})
