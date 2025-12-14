<script setup>
import Fuse from 'fuse.js'

// --- ETAT ---
const hadiths = ref([])
const loading = ref(true)
const searchQuery = ref('')
const selectedCategory = ref('')
const page = ref(1)
const itemsPerPage = 15
const fuse = ref(null)
const selectedHadith = ref(null)
const isDetailsLoading = ref(false)
const showModal = ref(false)
const isDark = ref(false)

// ✅ MENU الكتب (MOBILE DRAWER) + SWIPE
const showBooksMenu = ref(false)
const drawerEl = ref(null)
const drawerTranslateX = ref(0)
const drawerWidth = ref(360)
const isSwipingDrawer = ref(false)
const drawerStartX = ref(0)
const drawerCurrentX = ref(0)

const openBooksMenu = async () => {
  showBooksMenu.value = true
  drawerTranslateX.value = 0
  await nextTick()
  if (drawerEl.value) {
    drawerWidth.value = drawerEl.value.getBoundingClientRect().width || 360
  }
}

const closeBooksMenu = () => {
  showBooksMenu.value = false
  drawerTranslateX.value = 0
  isSwipingDrawer.value = false
}

const onDrawerTouchStart = (e) => {
  if (!e.touches?.length) return
  isSwipingDrawer.value = true
  drawerStartX.value = e.touches[0].clientX
  drawerCurrentX.value = drawerStartX.value
}

const onDrawerTouchMove = (e) => {
  if (!isSwipingDrawer.value || !e.touches?.length) return
  drawerCurrentX.value = e.touches[0].clientX
  const delta = drawerCurrentX.value - drawerStartX.value // >0 vers la droite
  drawerTranslateX.value = Math.max(0, Math.min(delta, drawerWidth.value))
}

const onDrawerTouchEnd = () => {
  if (!isSwipingDrawer.value) return
  const delta = drawerCurrentX.value - drawerStartX.value
  const threshold = drawerWidth.value * 0.25
  if (delta > threshold) {
    closeBooksMenu()
  } else {
    drawerTranslateX.value = 0
  }
  isSwipingDrawer.value = false
}

// ✅ Bloquer le scroll derrière (quand drawer ouvert)
watch(showBooksMenu, (v) => {
  if (process.client) {
    document.body.style.overflow = v ? 'hidden' : ''
  }
})

// ✅ SCROLL TOP (AJOUT)
const showScrollTop = ref(false)

const scrollToTop = () => {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  })
}

const handleScroll = () => {
  showScrollTop.value = window.scrollY > 400
}

const nextPage = () => {
  if (page.value < totalPages.value) {
    page.value++
    scrollToTop()
  }
}

const prevPage = () => {
  if (page.value > 1) {
    page.value--
    scrollToTop()
  }
}

// --- CHARGEMENT ---
onMounted(async () => {
  // ✅ AJOUT: écouter le scroll pour le bouton "↑"
  window.addEventListener('scroll', handleScroll)

  try {
    const savedTheme = localStorage.getItem('theme')
    if (
      savedTheme === 'dark' ||
      (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)
    ) {
      isDark.value = true
      document.documentElement.classList.add('dark')
    }

    const res = await fetch('/data/bukhari/index_min.json')
    if (!res.ok) throw new Error(`Erreur ${res.status}: /data/bukhari/index_min.json`)

    const rawData = await res.json()
    hadiths.value = rawData

    fuse.value = new Fuse(rawData, {
      keys: ['s', 'c', 'id'],
      threshold: 0.2,
      ignoreLocation: true,
      useExtendedSearch: true
    })

    loading.value = false
  } catch (e) {
    console.error(e)
    alert('Erreur technique : ' + e.message)
  }
})

// ✅ AJOUT: nettoyer l'écouteur
onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
  if (process.client) document.body.style.overflow = ''
})

// --- DÉTAIL ---
const openDetails = async (item) => {
  showModal.value = true
  selectedHadith.value = null
  isDetailsLoading.value = true

  try {
    const bookRes = await fetch(`/data/bukhari/books/${item.b}.json`)
    const bookData = await bookRes.json()
    selectedHadith.value = bookData.find((h) => h.id === item.id)
  } catch (e) {
    console.error(e)
  } finally {
    isDetailsLoading.value = false
  }
}

// --- AFFICHAGE (DESIGN) ---
const renderHadith = (text) => {
  if (!text) return ''

  const regex =
    /((?:صَلَّى.*?وَسَلَّمَ|صلى الله عليه وسلم)(?:\s+(?:يَقُولُ|قَالَ|يُحَدِّثُ|خَطَبَ|يقول|قال|يحدث))?)/

  const match = text.match(regex)

  if (match && match.index > 0) {
    const splitIdx = match.index + match[0].length
    const sanad = text.substring(0, splitIdx)
    const matn = text.substring(splitIdx)

    const formattedSanad = sanad.replace(
      regex,
      '<span class="text-emerald-600 dark:text-emerald-400 font-bold">$1</span>'
    )

    // ✅ IMPORTANT : parenthèse (matn-box) appliquée UNIQUEMENT au MATN
    return `
      <div class="text-sm leading-loose text-slate-500 dark:text-slate-400 mb-4 font-sanad text-justify">
        ${formattedSanad}
      </div>
      <div class="matn-box relative">
        <p class="text-2xl md:text-3xl font-serif leading-[2.8] text-slate-900 dark:text-white font-bold text-justify">
          ${matn}
        </p>
      </div>
    `
  }

  return `
    <div class="matn-box relative">
      <p class="text-2xl md:text-3xl font-serif leading-[2.8] text-slate-900 dark:text-white font-bold text-justify">
        ${text}
      </p>
    </div>
  `
}

const normalizeSearchQuery = (text) =>
  text
    ? text
        .replace(/[\u064B-\u065F\u0670]/g, '')
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .trim()
    : ''

const toggleTheme = () => {
  isDark.value = !isDark.value
  if (isDark.value) {
    document.documentElement.classList.add('dark')
    localStorage.setItem('theme', 'dark')
  } else {
    document.documentElement.classList.remove('dark')
    localStorage.setItem('theme', 'light')
  }
}

const categories = computed(() => [...new Set(hadiths.value.map((h) => h.c))])

const filteredList = computed(() => {
  if (searchQuery.value) {
    if (!isNaN(searchQuery.value)) return hadiths.value.filter((h) => h.id == searchQuery.value)
    return fuse.value
      ? fuse.value.search(normalizeSearchQuery(searchQuery.value)).map((r) => r.item)
      : []
  }
  if (selectedCategory.value) return hadiths.value.filter((h) => h.c === selectedCategory.value)
  return hadiths.value
})

const paginatedList = computed(() => {
  const start = (page.value - 1) * itemsPerPage
  return filteredList.value.slice(start, start + itemsPerPage)
})

const totalPages = computed(() => Math.ceil(filteredList.value.length / itemsPerPage))

// ✅ AJOUT: quand on change filtre/recherche, on revient en haut aussi
watch([searchQuery, selectedCategory], () => {
  page.value = 1
  scrollToTop()
})
</script>

<template>
  <div
    class="min-h-screen bg-slate-50 dark:bg-[#0B1120] font-sans text-slate-800 dark:text-slate-100 dir-rtl transition-colors duration-300"
  >
    <header
      class="fixed top-0 w-full z-50 bg-white/90 dark:bg-[#0B1120]/90 backdrop-blur border-b border-slate-200 dark:border-slate-800 h-16 transition-all shadow-sm"
    >
      <div class="container mx-auto px-4 h-full flex items-center justify-between">
        <div class="flex items-center gap-4">
          <NuxtLink
            to="/"
            class="w-8 h-8 flex items-center justify-center bg-slate-100 dark:bg-slate-800 hover:bg-emerald-100 rounded-full transition text-slate-500 hover:text-emerald-600"
            >🏠</NuxtLink
          >
          <div class="flex items-center gap-3 cursor-pointer" @click="(selectedCategory = ''), (searchQuery = '')">
            <img
              src="/logo.png"
              alt="Logo"
              class="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-slate-700"
              onerror="this.style.display='none'"
            />
            <h1 class="font-serif text-2xl font-bold tracking-wide text-slate-800 dark:text-white">صحيح البخاري</h1>
          </div>
        </div>

        <!-- ✅ AJOUT: bouton الكتب (mobile) + theme (inchangé) -->
        <div class="flex items-center gap-2">
          <button
            @click="openBooksMenu"
            class="lg:hidden w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200 flex items-center justify-center hover:scale-110 transition border border-slate-200 dark:border-slate-700"
            aria-label="الكتب والأبواب"
          >
            📚
          </button>

          <button
            @click="toggleTheme"
            class="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-yellow-400 flex items-center justify-center hover:scale-110 transition border border-slate-200 dark:border-slate-700"
          >
            <span v-if="isDark">☀️</span><span v-else>🌙</span>
          </button>
        </div>
      </div>
    </header>

    <!-- ✅ AJOUT: MOBILE DRAWER + SWIPE -->
    <div v-if="showBooksMenu" class="lg:hidden fixed inset-0 z-[90]">
      <div class="absolute inset-0 bg-slate-900/60" @click="closeBooksMenu"></div>

      <div
        ref="drawerEl"
        class="absolute top-0 right-0 h-full w-[85%] max-w-[360px] bg-white dark:bg-[#131c31] shadow-2xl border-l border-slate-200 dark:border-slate-800 transition-transform duration-200 ease-out"
        :style="{ transform: `translateX(${drawerTranslateX}px)` }"
        @touchstart.passive="onDrawerTouchStart"
        @touchmove.passive="onDrawerTouchMove"
        @touchend="onDrawerTouchEnd"
        @touchcancel="onDrawerTouchEnd"
      >
        <div
          class="h-16 px-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-[#131c31] sticky top-0 z-10"
        >
          <div class="font-bold text-slate-600 dark:text-slate-200">الكتب والأبواب</div>
          <button
            class="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-400"
            @click="closeBooksMenu"
          >
            ✕
          </button>
        </div>

        <div class="p-2 space-y-1 overflow-y-auto h-[calc(100%-4rem)] custom-scrollbar">
          <button
            @click="(selectedCategory = ''), (searchQuery = ''), closeBooksMenu()"
            class="w-full text-right px-3 py-2.5 rounded-lg text-sm transition font-bold"
            :class="
              !selectedCategory && !searchQuery
                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
            "
          >
            📚 جميع الأحاديث
          </button>

          <button
            v-for="cat in categories"
            :key="cat"
            @click="(selectedCategory = cat), (searchQuery = ''), closeBooksMenu()"
            class="w-full text-right px-3 py-2.5 rounded-lg text-sm transition flex justify-between items-center group"
            :class="
              selectedCategory === cat
                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
            "
          >
            <span class="truncate">{{ cat }}</span>
            <span
              class="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 dark:text-slate-500"
            >
              {{ hadiths.filter((h) => h.c === cat).length }}
            </span>
          </button>
        </div>
      </div>
    </div>

    <main class="container mx-auto px-4 pt-24 pb-20 max-w-7xl">
      <div v-if="loading" class="flex flex-col items-center justify-center h-[60vh] animate-pulse">
        <div
          class="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full mb-4 flex items-center justify-center text-3xl"
        >
          📚
        </div>
        <p>جاري تحميل المكتبة...</p>
      </div>

      <div v-else class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <aside
          class="hidden lg:block lg:col-span-3 sticky top-24 bg-white dark:bg-[#131c31] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm max-h-[80vh] overflow-y-auto custom-scrollbar"
        >
          <div class="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-[#131c31] sticky top-0 z-10">
            <h3 class="font-bold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">الكتب والأبواب</h3>
          </div>
          <div class="p-2 space-y-1">
            <button
              @click="(selectedCategory = ''), (searchQuery = '')"
              class="w-full text-right px-3 py-2.5 rounded-lg text-sm transition font-bold"
              :class="
                !selectedCategory && !searchQuery
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              "
            >
              📚 جميع الأحاديث
            </button>

            <button
              v-for="cat in categories"
              :key="cat"
              @click="(selectedCategory = cat), (searchQuery = '')"
              class="w-full text-right px-3 py-2.5 rounded-lg text-sm transition flex justify-between items-center group"
              :class="
                selectedCategory === cat
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              "
            >
              <span class="truncate">{{ cat }}</span>
              <span class="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 dark:text-slate-500">
                {{ hadiths.filter((h) => h.c === cat).length }}
              </span>
            </button>
          </div>
        </aside>

        <section class="lg:col-span-9">
          <div class="sticky top-20 z-40 mb-8">
            <div
              class="relative shadow-xl shadow-slate-200/50 dark:shadow-black/50 rounded-2xl bg-white/90 dark:bg-[#131c31]/90 backdrop-blur border border-slate-100 dark:border-slate-700 transition-all focus-within:ring-4 focus-within:ring-emerald-500/10"
            >
              <input
                v-model="searchQuery"
                type="text"
                placeholder="ابحث عن كلمة (مثال: النية، رمضان) أو رقم الحديث..."
                class="w-full p-5 pl-12 bg-transparent rounded-2xl outline-none text-lg font-medium text-slate-800 dark:text-white"
              />
              <span class="absolute left-4 top-1/2 -translate-y-1/2 text-2xl opacity-30">🔍</span>
              <button v-if="searchQuery" @click="searchQuery = ''" class="absolute left-12 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 p-1">
                ✕
              </button>
            </div>
          </div>

          <div class="space-y-6">
            <div
              v-for="h in paginatedList"
              :key="h.id"
              class="bg-white dark:bg-[#131c31] rounded-[2rem] p-1 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all duration-300 group cursor-pointer"
              @click="openDetails(h)"
            >
              <div class="bg-white dark:bg-[#131c31] rounded-[1.8rem] p-6 sm:p-8">
                <div class="flex justify-between items-start mb-6 border-b border-slate-50 dark:border-slate-800 pb-4">
                  <div class="flex flex-wrap gap-2 items-center">
                    <span class="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold px-3 py-1 rounded-lg font-mono"
                      >#{{ h.id }}</span
                    >

                    <span
                      class="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold px-3 py-1 rounded-lg border border-emerald-100 dark:border-emerald-900/30"
                      >{{ h.c }}</span
                    >

                    <button
                      v-if="h.has_video"
                      @click.stop="openDetails(h)"
                      class="flex items-center gap-1 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-[10px] font-bold px-2 py-1 rounded-lg border border-red-100 dark:border-red-900/30 animate-pulse cursor-pointer hover:scale-105 transition"
                      title="فيديو متوفر"
                    >
                      <span>▶</span> فيديو
                    </button>
                  </div>
                </div>

                <div v-html="renderHadith(h.t)"></div>

                <div
                  class="mt-6 pt-4 border-t border-slate-50 dark:border-slate-800 flex justify-end gap-3 items-center text-sm font-bold text-slate-400 group-hover:text-emerald-600 transition-colors"
                >
                  <span>شرح فتح الباري + ترجمة</span><span class="text-xl">💡</span>
                </div>
              </div>
            </div>
          </div>

          <div v-if="totalPages > 1" class="mt-16 flex justify-center items-center gap-4">
            <button
              @click="prevPage"
              :disabled="page === 1"
              class="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30 transition dark:text-white"
            >
              <span>→</span>
            </button>

            <div
              class="px-6 py-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm font-bold text-slate-600 dark:text-slate-300 font-mono"
            >
              {{ page }} / {{ totalPages }}
            </div>

            <button
              @click="nextPage"
              :disabled="page === totalPages"
              class="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30 transition dark:text-white"
            >
              <span>←</span>
            </button>
          </div>
        </section>
      </div>

      <!-- ✅ AJOUT: bouton retour en haut -->
      <button
        v-if="showScrollTop"
        @click="scrollToTop"
        class="fixed bottom-6 left-6 z-[90] rounded-full bg-emerald-600 text-white w-12 h-12 shadow-lg hover:bg-emerald-700 transition flex items-center justify-center"
        aria-label="العودة إلى الأعلى"
      >
        ↑
      </button>

      <!-- MODAL -->
      <div v-if="showModal" class="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6" @click.self="showModal = false">
        <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"></div>

        <div
          class="relative bg-white dark:bg-[#0f172a] w-full max-w-4xl max-h-[90vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden animate-slide-up border border-slate-200 dark:border-slate-800"
        >
          <div class="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-[#0f172a] sticky top-0 z-10">
            <!-- ✅ SEULE MODIF ICI : restaurer le lien au milieu -->
            <div class="flex items-center gap-3">
              <h3 class="text-xl font-bold text-slate-800 dark:text-white">
                حديث رقم {{ selectedHadith?.id || '...' }}
              </h3>
              <NuxtLink
                v-if="selectedHadith"
                :to="`/bukhari/${selectedHadith.id}`"
                target="_blank"
                class="text-xs bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full text-slate-500 hover:text-emerald-600 transition"
              >
                🔗 صفحة مستقلة
              </NuxtLink>
            </div>

            <button
              @click="showModal = false"
              class="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-800 hover:bg-red-50 hover:text-red-500 dark:hover:text-red-400 flex items-center justify-center transition text-slate-400 text-lg"
            >
              ✕
            </button>
          </div>

          <div class="p-8 sm:p-10 overflow-y-auto custom-scrollbar bg-slate-50/50 dark:bg-[#0B1120]">
            <div v-if="isDetailsLoading" class="py-20 text-center text-slate-400">
              <div class="text-4xl animate-spin mb-4">⏳</div>
              <p>جاري جلب التفاصيل...</p>
            </div>

            <div v-else-if="selectedHadith" class="space-y-10">
              <div v-if="selectedHadith.youtube_id" class="mx-auto rounded-2xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-700 bg-black"
                   :class="selectedHadith.is_short ? 'max-w-[300px] aspect-[9/16]' : 'w-full aspect-video'">
                <iframe :src="`https://www.youtube.com/embed/${selectedHadith.youtube_id}`" class="w-full h-full" frameborder="0" allowfullscreen></iframe>
              </div>

              <div v-if="selectedHadith.audio_url" class="bg-white dark:bg-[#131c31] p-4 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center gap-4 shadow-sm">
                <div class="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 w-12 h-12 rounded-full flex items-center justify-center shrink-0 text-xl">
                  🔊
                </div>
                <audio controls class="w-full h-8"><source :src="selectedHadith.audio_url" type="audio/mpeg" /></audio>
              </div>

              <div v-html="renderHadith(selectedHadith.text_chakl)"></div>

              <div
                v-if="selectedHadith.english_text"
                class="bg-white dark:bg-[#131c31] p-6 rounded-2xl text-left border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-sans text-sm leading-relaxed shadow-sm"
                dir="ltr"
              >
                <strong class="block text-emerald-600 text-xs uppercase mb-2 tracking-wider">English Translation</strong>
                {{ selectedHadith.english_text }}
              </div>

              <div v-if="selectedHadith.explication" class="relative bg-white dark:bg-[#131c31] p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div
                  class="absolute -top-4 right-8 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-4 py-1 rounded-full text-xs font-bold border border-amber-200 dark:border-amber-700/50 flex items-center gap-1"
                >
                  <span>💡</span> شرح فتح الباري
                </div>
                <p class="text-lg leading-loose text-slate-700 dark:text-slate-300 text-justify font-sans mt-2">
                  {{ selectedHadith.explication }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style>
.font-serif { font-family: 'Amiri', serif; }
.font-sanad { font-family: 'Noto Kufi Arabic', sans-serif; }
.dir-rtl { direction: rtl; }
.custom-scrollbar::-webkit-scrollbar { width: 6px; }
.custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 10px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.dark .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #475569; }
@keyframes slide-up { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
.animate-slide-up { animation: slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1); }

/* ✅ COPIE EXACTE DU CSS "PARENTHÈSE" (rien d'autre) */
.matn-box {
  background: linear-gradient(to left, #ffffff 0%, #f8fafc 100%);
  border-right: 5px solid #10B981;
  padding: 1.5rem;
  border-radius: 1rem;
  margin-top: 1rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.02);
}
.dark .matn-box {
  background: linear-gradient(to left, #1e293b 0%, #0f172a 100%);
  border-right-color: #34D399;
  box-shadow: none;
}
</style>
