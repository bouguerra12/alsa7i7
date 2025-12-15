import { defineNuxtConfig } from 'nuxt/config'
import fs from 'fs'
import path from 'path'

export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: true },

  // ✅ Modules
  modules: ['@nuxtjs/tailwindcss'],

  // --- SEO CONFIGURATION (Generate Static Routes) ---
  hooks: {
    async 'nitro:config'(nitroConfig) {
      if (nitroConfig.dev) return

      try {
        const filePath = path.resolve(__dirname, 'public/data/bukhari/index_min.json')

        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8')
          const data = JSON.parse(content)

          const routes = data.map((h: any) => `/bukhari/${h.id}`)

          if (!nitroConfig.prerender) nitroConfig.prerender = {}
          if (!nitroConfig.prerender.routes) nitroConfig.prerender.routes = []

          nitroConfig.prerender.routes.push(...routes)

          console.log(`✅ SEO: Added ${routes.length} Bukhari hadith pages to generation queue.`)
        } else {
          console.warn("⚠️ Warning: public/data/bukhari/index_min.json not found. Did you run the Python script?")
        }
      } catch (e) {
        console.error('⚠️ Error reading index_min.json for SEO:', e)
      }
    }
  },

  app: {
    head: {
      htmlAttrs: { lang: 'ar', dir: 'rtl' },
      title: 'Al-Sahih - صحيح البخاري',
      meta: [
        { name: 'description', content: 'البحث في صحيح البخاري بدقة وسرعة مع الشرح.' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { charset: 'utf-8' }
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },

        // ✅ Fonts (Amiri + Noto Kufi Arabic + Noto Naskh Arabic)
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href:
            'https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Noto+Kufi+Arabic:wght@400;700&family=Noto+Naskh+Arabic:wght@400;700&display=swap'
        }
      ],

      // ✅ Google tag (gtag.js) - officiel
      script: [
        { async: true, src: 'https://www.googletagmanager.com/gtag/js?id=G-P7J0S59D58' },
        {
          children: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            window.gtag = gtag;
            gtag('js', new Date());
            gtag('config', 'G-P7J0S59D58', { anonymize_ip: true });
          `
        }
      ]
    }
  }
})
