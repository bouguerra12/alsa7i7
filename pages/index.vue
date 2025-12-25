<script setup>
useSeoMeta({
  title: 'Al-Sahih - المنصة الحديثية',
  description: 'موسوعة الأحاديث النبوية الشريفة',
})

const books = [
  { id: 'bukhari', title: 'Sahih Al-Bukhari', arabic: 'صحيح البخاري', color: 'bg-emerald-600', link: '/bukhari', available: true },
  { id: 'muslim', title: 'Sahih Muslim', arabic: 'صحيح مسلم', color: 'bg-blue-600', link: '/muslim', available: false },
]

// ✅ YouTube Channel ID (UC...)
const CHANNEL_ID = 'UCvf66KiiFwxLnDQ_d0djykA'

// ✅ Load latest Shorts from server API (key stays server-side)
const { data: shorts, pending, error } = await useFetch('/api/youtube/shorts', {
  server: true,
  lazy: true,
})

// ✅ Network warmup + YouTube subscribe widget script
useHead({
  link: [
    { rel: 'preconnect', href: 'https://i.ytimg.com', crossorigin: '' },
    { rel: 'dns-prefetch', href: 'https://i.ytimg.com' },
    { rel: 'preconnect', href: 'https://apis.google.com', crossorigin: '' },
    { rel: 'dns-prefetch', href: 'https://apis.google.com' },
  ],
  script: [
    { src: 'https://apis.google.com/js/platform.js', async: true, defer: true },
  ],
})

// ✅ Force render of subscribe widget in SPA/NUXT hydration
const renderSubscribe = () => {
  if (process.server) return false
  const g = window.gapi
  if (g?.ytsubscribe?.go) {
    g.ytsubscribe.go()
    return true
  }
  return false
}

// ✅ Preload thumbnails + retry subscribe render
onMounted(() => {
  const list = Array.isArray(shorts.value) ? shorts.value : []
  list.slice(0, 3).forEach((v) => {
    if (!v?.thumb) return
    const img = new Image()
    img.decoding = 'async'
    img.loading = 'eager'
    img.referrerPolicy = 'no-referrer'
    img.src = v.thumb
  })

  // Retry for a short time (script timing)
  let tries = 0
  const t = setInterval(() => {
    tries++
    if (renderSubscribe() || tries > 40) clearInterval(t) // ~4s
  }, 100)
})
</script>

<template>
  <div class="min-h-screen bg-slate-50 dir-rtl font-sans text-slate-800 flex flex-col items-center justify-center">
    <header class="text-center mb-12 flex flex-col items-center">
      <img
        src="/logo.png"
        alt="Al-Sahih Logo"
        class="w-24 h-24 mb-6"
        loading="eager"
      />

      <span class="block text-lg md:text-xl font-normal text-slate-600 mt-2">
        يهتم بنشر الأحاديث النبوية الصحيحة من كتب السنة الموثوقة
      </span>

      <p class="text-slate-500 text-lg">
        اختر الكتاب الذي تريد البحث فيه
      </p>
    </header>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl w-full px-4">
      <NuxtLink
        to="/bukhari?videos=1"
        class="bg-white rounded-3xl p-8 shadow-lg border border-emerald-100 hover:shadow-2xl hover:border-emerald-300 transition group cursor-pointer flex flex-col items-center text-center"
      >
        <div class="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-4xl mb-4 group-hover:scale-110 transition">
          📗
        </div>
        <h2 class="text-2xl font-bold text-emerald-800 mb-1">صحيح البخاري</h2>
        <span class="text-sm text-emerald-600 font-bold bg-emerald-50 px-3 py-1 rounded-full mt-2">
          متوفر الان
        </span>
      </NuxtLink>

      <NuxtLink
        to="/muslim"
        class="bg-white rounded-3xl p-8 shadow-lg border border-blue-100 hover:shadow-2xl hover:border-blue-300 transition group cursor-pointer flex flex-col items-center text-center"
      >
        <div class="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center text-4xl mb-4 group-hover:scale-110 transition">
          📘
        </div>
        <h2 class="text-2xl font-bold text-blue-800 mb-1">صحيح مسلم</h2>
        <span class="text-sm text-blue-400 font-bold bg-blue-50 px-3 py-1 rounded-full mt-2">
          قريباً
        </span>
      </NuxtLink>
    </div>

    <footer class="mt-16 text-center w-full">
      <p class="text-slate-500 mb-4">تابع المنصة على</p>

      <div class="flex gap-6 justify-center">
        <a
          href="https://www.youtube.com/@alsa7i7/"
          target="_blank"
          rel="noopener"
          class="flex items-center gap-2 px-5 py-3 rounded-full bg-red-50 text-red-600 font-bold hover:bg-red-100 transition"
        >
          ▶️ YouTube
        </a>

        <a
          href="https://www.tiktok.com/@sa7i7.tv"
          target="_blank"
          rel="noopener"
          class="flex items-center gap-2 px-5 py-3 rounded-full bg-slate-100 text-slate-800 font-bold hover:bg-slate-200 transition"
        >
          🎵 TikTok
        </a>
      </div>

      <!-- ✅ Latest Shorts (API) -->
      <div class="mt-12 max-w-6xl mx-auto px-4">
        <h2 class="text-slate-600 text-sm mb-4">
          أحدث المقاطع القصيرة
        </h2>

        <!-- ✅ Subscribe button (official) + ClientOnly -->
    

        <!-- ✅ Fallback (always works, even with AdBlock) -->
        <div class="flex justify-center mb-6">
          <a
            href="https://www.youtube.com/@alsa7i7?sub_confirmation=1"
            target="_blank"
            rel="noopener"
            class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-600 text-white font-bold hover:bg-red-700 transition"
          >
            اشترك في القناة ▶️
          </a>
        </div>

        <div v-if="pending" class="text-slate-400 text-sm">
          ...جار التحميل
        </div>

        <div v-else-if="error" class="text-red-600 text-sm">
          حدث خطأ أثناء تحميل المقاطع
        </div>

        <div v-else-if="shorts?.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <a
            v-for="v in shorts"
            :key="v.id"
            :href="v.url"
            target="_blank"
            rel="noopener"
            class="group bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden hover:shadow-xl transition text-right"
          >
            <div class="relative w-full aspect-[9/16] bg-black">
              <img
                :src="v.thumb"
                :alt="v.title"
                class="absolute inset-0 w-full h-full object-cover"
                loading="eager"
                decoding="async"
                @error="(e) => {
                  const img = e?.target
                  if (!img || !img.dataset) return

                  const id = v.id
                  const tries = [
                    `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
                    `https://i.ytimg.com/vi/${id}/sddefault.jpg`,
                    `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
                    `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
                    `https://i.ytimg.com/vi/${id}/default.jpg`,
                  ]

                  const i = parseInt(img.dataset.try || '0', 10)
                  if (i >= tries.length) return

                  img.dataset.try = String(i + 1)
                  img.src = tries[i]
                }"
              />

              <div class="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-black/10"></div>

              <div class="absolute inset-0 flex items-center justify-center">
                <svg
                  class="w-16 h-16 opacity-95 drop-shadow-md group-hover:scale-105 transition-transform"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    fill="#FF0000"
                    d="M23.498 6.186a3.012 3.012 0 0 0-2.12-2.13C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.378.556a3.012 3.012 0 0 0-2.12 2.13A31.23 31.23 0 0 0 0 12a31.23 31.23 0 0 0 .502 5.814 3.012 3.012 0 0 0 2.12 2.13C4.5 20.5 12 20.5 12 20.5s7.5 0 9.378-.556a3.012 3.012 0 0 0 2.12-2.13A31.23 31.23 0 0 0 24 12a31.23 31.23 0 0 0-.502-5.814z"
                  />
                  <path fill="white" d="M9.75 15.5v-7l6 3.5-6 3.5z" />
                </svg>
              </div>
            </div>

            <div class="p-4">
              <p class="text-sm font-bold text-slate-800 line-clamp-2">
                {{ v.title }}
              </p>
              <p class="mt-1 text-xs text-slate-400">
                {{ new Date(v.publishedAt).toLocaleDateString('ar-TN') }}
              </p>
            </div>
          </a>
        </div>

        <div v-else class="text-slate-400 text-sm">
          لا توجد مقاطع قصيرة الآن
        </div>
      </div>
    </footer>
  </div>
</template>

<style>
.font-serif { font-family: 'Amiri', serif; }
</style>
