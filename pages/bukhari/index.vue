<script setup>
import Fuse from 'fuse.js'
import { toPng } from 'html-to-image'
import { useRoute, useRouter } from 'vue-router'

// --- ETAT ---
const hadiths = ref([])
const loading = ref(true)
const searchQuery = ref('')

// ✅ Filtre par livre (bf)
const selectedBookBf = ref(null)

// ✅ Filtre "avec فيديو"
const showVideoOnly = ref(false)

const page = ref(1)
const itemsPerPage = 15
const fuse = ref(null)

const selectedHadith = ref(null)
const selectedHadithMeta = ref(null) // ✅ meta (uid/bf/bi/sr...)
const isDetailsLoading = ref(false)
const showModal = ref(false)

const isDark = ref(false)

// ✅ ROUTE (query ?book= ?videos=)
const route = useRoute()
const router = useRouter()

const setBookFromQuery = (q) => {
  const n = Number(q)
  selectedBookBf.value = Number.isFinite(n) && n > 0 ? n : null
}

// ✅ NEW: init mode فيديو from URL query
const setVideoFromQuery = (q) => {
  const v = String(q || '').trim()
  showVideoOnly.value = v === '1' || v.toLowerCase() === 'true'
}

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
  await nextTick()
  updateDrawerScrollHint()
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
  if (delta > threshold) closeBooksMenu()
  else drawerTranslateX.value = 0
  isSwipingDrawer.value = false
}

// ✅ Bloquer le scroll derrière (quand drawer ouvert)
watch(showBooksMenu, (v) => {
  if (process.client) document.body.style.overflow = v ? 'hidden' : ''
})

// ✅ SCROLL TOP
const showScrollTop = ref(false)

const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' })
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

// ✅ Actions menu
const goAllHadiths = async () => {
  showVideoOnly.value = false
  searchQuery.value = ''
  selectedBookBf.value = null
  page.value = 1
  scrollToTop()
  if (route.query.book != null || route.query.videos != null) {
    await router.replace({ query: { ...route.query, book: undefined, videos: undefined } })
  }
}

const goVideoHadiths = async () => {
  showVideoOnly.value = true
  searchQuery.value = ''
  selectedBookBf.value = null
  page.value = 1
  scrollToTop()
  if (route.query.book != null || route.query.videos !== '1') {
    await router.replace({ query: { ...route.query, book: undefined, videos: '1' } })
  }
}

// --- CHARGEMENT ---
onMounted(async () => {
  window.addEventListener('scroll', handleScroll)

  // ✅ init from URL query
  setBookFromQuery(route.query.book)
  setVideoFromQuery(route.query.videos)

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

    // ✅ ordre stable : bf puis bi
    hadiths.value = Array.isArray(rawData)
      ? rawData.slice().sort((a, b) => {
          const abf = Number(a?.bf ?? a?.b ?? 0)
          const bbf = Number(b?.bf ?? b?.b ?? 0)
          if (abf !== bbf) return abf - bbf
          const abi = Number(a?.bi ?? 0)
          const bbi = Number(b?.bi ?? 0)
          return abi - bbi
        })
      : []

    fuse.value = new Fuse(hadiths.value, {
      keys: ['s', 'c', 'id', 'uid', 'sr'],
      threshold: 0.2,
      ignoreLocation: true,
      useExtendedSearch: true
    })

    loading.value = false

    await nextTick()
    updateAsideScrollHint()
  } catch (e) {
    console.error(e)
    alert('Erreur technique : ' + (e?.message || e))
  }
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
  if (process.client) document.body.style.overflow = ''
})

// ✅ sync route.query.book -> selectedBookBf
watch(
  () => route.query.book,
  (v) => {
    setBookFromQuery(v)
  }
)

// ✅ sync route.query.videos -> showVideoOnly
watch(
  () => route.query.videos,
  (v) => {
    setVideoFromQuery(v)
  }
)

// --- DÉTAIL (FIX MODAL) ---
const openDetails = async (item, evt) => {
  if (evt?.stopPropagation) evt.stopPropagation()
  if (evt?.preventDefault) evt.preventDefault()

  // ✅ ouvrir modal immédiatement
  showModal.value = true
  selectedHadith.value = null
  selectedHadithMeta.value = item
  isDetailsLoading.value = true

  // ✅ laisser le DOM afficher modal + loader
  await nextTick()

  // ✅ ne PAS muter item
  const bf = Number(item?.bf ?? item?.b ?? NaN)
  const bi = Number.isInteger(item?.bi) ? item.bi : null

  if (!Number.isFinite(bf) || bf <= 0) {
    console.error('Missing/invalid bf in index item:', item)
    isDetailsLoading.value = false
    return
  }

  try {
    const bookRes = await fetch(`/data/bukhari/books/${bf}.json`)
    if (!bookRes.ok) throw new Error(`Book ${bf} fetch failed: ${bookRes.status}`)
    const bookData = await bookRes.json()

    selectedHadith.value =
      Number.isInteger(bi) ? bookData[bi] : bookData.find((h) => h.id === item.id) || null
  } catch (e) {
    console.error(e)
    selectedHadith.value = null
  } finally {
    isDetailsLoading.value = false
  }
}

// --- AFFICHAGE (SANAD + MATN) ---
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

    return `
      <div class="text-sm leading-loose text-slate-500 dark:text-slate-400 mb-4 font-sanad text-justify">
        ${formattedSanad}
      </div>
      <div class="matn-box relative">
        <p class="text-2xl md:text-3xl font-serif leading-[2.4] md:leading-[2.8] lg:leading-[3.0] text-slate-900 dark:text-white font-bold text-justify">
          ${matn}
        </p>
      </div>
    `
  }

  return `
    <div class="matn-box relative">
      <p class="text-2xl md:text-3xl font-serif leading-[2.4] md:leading-[2.8] lg:leading-[3.0] text-slate-900 dark:text-white font-bold text-justify">
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

// ✅ Liste الكتب مرتبة حسب bf + "1."
const books = computed(() => {
  const byBf = new Map()

  for (const h of hadiths.value) {
    const bf = Number(h?.bf ?? h?.b)
    if (!Number.isFinite(bf)) continue

    if (!byBf.has(bf)) {
      byBf.set(bf, {
        bf,
        name: String(h?.c || '').trim() || `كتاب ${bf}`,
        count: 1
      })
    } else {
      byBf.get(bf).count++
    }
  }

  return Array.from(byBf.values())
    .sort((a, b) => a.bf - b.bf)
    .map((b) => ({ ...b, numLabel: `${b.bf}.` }))
})

// ✅ NEW: compteur vidéos
const videoCount = computed(() => hadiths.value.filter((h) => !!h.has_video).length)

// ✅ NEW: compteur vidéos حسب الكتاب الحالي (si book sélectionné)
const videoCountInCurrent = computed(() => {
  if (selectedBookBf.value != null) {
    return hadiths.value.filter(
      (h) => Number(h.bf ?? h.b) === Number(selectedBookBf.value) && !!h.has_video
    ).length
  }
  return videoCount.value
})

const isUidLike = (v) => /^\d+-\d+$/.test(String(v || '').trim())

const filteredList = computed(() => {
  const q = String(searchQuery.value || '').trim()
  let list = hadiths.value

  if (q) {
    if (isUidLike(q)) list = hadiths.value.filter((h) => String(h.uid) === q)
    else if (!isNaN(q)) list = hadiths.value.filter((h) => h.id == q)
    else list = fuse.value ? fuse.value.search(normalizeSearchQuery(q)).map((r) => r.item) : []
  } else if (selectedBookBf.value != null) {
    list = hadiths.value.filter((h) => Number(h.bf ?? h.b) === Number(selectedBookBf.value))
  } else {
    list = hadiths.value
  }

  // ✅ appliquer filtre vidéo à la fin
  if (showVideoOnly.value) {
    list = list.filter((h) => !!h.has_video)
  }

  return list
})

const paginatedList = computed(() => {
  const start = (page.value - 1) * itemsPerPage
  return filteredList.value.slice(start, start + itemsPerPage)
})

const totalPages = computed(() => Math.ceil(filteredList.value.length / itemsPerPage))

// ✅ keep URL in sync when selecting a book (and reset page)
watch([searchQuery, selectedBookBf, showVideoOnly], async () => {
  page.value = 1
  scrollToTop()

  // si user tape une recherche => on enlève ?book= et ?videos=
  if (String(searchQuery.value || '').trim()) {
    if (route.query.book != null || route.query.videos != null) {
      await router.replace({ query: { ...route.query, book: undefined, videos: undefined } })
    }
    return
  }

  // si mode فيديو => on met ?videos=1 et on enlève ?book=
  if (showVideoOnly.value) {
    if (route.query.videos !== '1' || route.query.book != null) {
      await router.replace({ query: { ...route.query, videos: '1', book: undefined } })
    }
    return
  } else {
    // si خرجنا من mode فيديو => ننحي videos
    if (route.query.videos != null) {
      await router.replace({ query: { ...route.query, videos: undefined } })
    }
  }

  // si book sélectionné => on met ?book=
  if (selectedBookBf.value != null) {
    const next = String(selectedBookBf.value)
    if (String(route.query.book || '') !== next) {
      await router.replace({ query: { ...route.query, book: next } })
    }
  } else {
    // aucun book => on enlève ?book=
    if (route.query.book != null) {
      await router.replace({ query: { ...route.query, book: undefined } })
    }
  }
})

//✅ ====== SHARE CARD (IMAGE EXPORT) ======
const shareCardRef = ref(null)
const shareBusy = ref(false)
const SHARE_BG_URL = '/share/bg1080x1920.png'

// ✅ Share URL uses canonical uid
const getHadithShareUrl = (uid) => `https://alsa7i7.com/bukhari/${uid}`

const isIOS = () => {
  if (!process.client) return false
  const ua = navigator.userAgent || ''
  return /iPad|iPhone|iPod/.test(ua)
}

const ensureFontsReady = async () => {
  if (process.client && document?.fonts?.ready) {
    await document.fonts.ready
  }
}

const splitHadithText = (text) => {
  if (!text) return { sanad: '', matn: '' }

  const regex =
    /((?:صَلَّى.*?وَسَلَّمَ|صلى الله عليه وسلم)(?:\s+(?:يَقُولُ|قَالَ|يُحَدِّثُ|خَطَبَ|يقول|قال|يحدث))?)/

  const match = text.match(regex)

  if (match && match.index > 0) {
    const splitIdx = match.index + match[0].length
    return {
      sanad: text.substring(0, splitIdx).trim(),
      matn: text.substring(splitIdx).trim()
    }
  }

  return { sanad: '', matn: text.trim() }
}

const getShareLayout = (text) => {
  const { sanad, matn } = splitHadithText(text)

  const len = (matn || '').length
  const sanadLen = (sanad || '').length

  let padX = 90
  let sanadSize = 28
  let sanadLH = 1.7
  let matnSize = 52
  let matnLH = 2.0
  let vAlign = 'center'

  if (len > 650) {
    padX = 78
    sanadSize = 22
    matnSize = 38
    matnLH = 1.75
    vAlign = 'flex-start'
  } else if (len > 420) {
    padX = 84
    sanadSize = 24
    matnSize = 42
    matnLH = 1.85
    vAlign = 'center'
  } else if (len < 220) {
    padX = 96
    sanadSize = 28
    matnSize = 60
    matnLH = 2.1
    vAlign = 'center'
  }

  if (sanadLen > 260) {
    sanadSize = Math.max(20, sanadSize - 3)
  }

  return { sanad, matn, padX, sanadSize, sanadLH, matnSize, matnLH, vAlign }
}

// ✅ helpers canvas iOS
const loadImageBitmap = async (src) => {
  const res = await fetch(src, { cache: 'no-store' })
  const blob = await res.blob()
  if ('createImageBitmap' in window) return await createImageBitmap(blob)

  const url = URL.createObjectURL(blob)
  const img = new Image()
  img.crossOrigin = 'anonymous'
  await new Promise((resolve, reject) => {
    img.onload = resolve
    img.onerror = reject
    img.src = url
  })
  return img
}

const wrapLines = (ctx, text, maxWidth) => {
  if (!text) return []
  const words = text.split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''

  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    const width = ctx.measureText(test).width
    if (width <= maxWidth) line = test
    else {
      if (line) lines.push(line)
      line = w
    }
  }
  if (line) lines.push(line)
  return lines
}

const exportHadithImageIOS = async () => {
  const h = selectedHadith.value
  if (!h) return

  await ensureFontsReady()

  const W = 1080
  const H = 1920
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')

  const bg = await loadImageBitmap(SHARE_BG_URL)
  ctx.drawImage(bg, 0, 0, W, H)

  const v = getShareLayout(h.text_chakl)
  const safeTop = 360
  const safeBottom = 300
  const safeH = H - safeTop - safeBottom
  const maxWidth = W - v.padX * 2
  const xRight = W - v.padX
  const xLeft = v.padX

  ctx.direction = 'rtl'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'top'

  ctx.fillStyle = 'rgba(0,0,0,.60)'
  ctx.font = `600 ${v.sanadSize}px "Noto Kufi Arabic","Tahoma","Arial",sans-serif`
  const sanadLines = v.sanad ? wrapLines(ctx, v.sanad, maxWidth) : []
  const sanadLineH = v.sanadSize * v.sanadLH
  const sanadH = sanadLines.length * sanadLineH

  ctx.fillStyle = '#000'
  ctx.font = `800 ${v.matnSize}px "Amiri","Noto Naskh Arabic","Tahoma","Arial",sans-serif`
  const matnLines = v.matn ? wrapLines(ctx, v.matn, maxWidth) : []
  const matnLineH = v.matnSize * v.matnLH
  const matnH = matnLines.length * matnLineH

  const gap1 = sanadLines.length ? 32 : 0
  const gap2 = 40
  const footerH = 40
  const totalH = sanadH + gap1 + matnH + gap2 + footerH

  let y = safeTop
  if (v.vAlign === 'center' && totalH < safeH) {
    y = safeTop + Math.floor((safeH - totalH) / 2)
  }

  if (sanadLines.length) {
    ctx.fillStyle = 'rgba(0,0,0,.60)'
    ctx.font = `600 ${v.sanadSize}px "Noto Kufi Arabic","Tahoma","Arial",sans-serif`
    for (const line of sanadLines) {
      ctx.fillText(line, xRight, y)
      y += sanadLineH
    }
    y += gap1
  }

  ctx.fillStyle = '#000'
  ctx.font = `800 ${v.matnSize}px "Amiri","Noto Naskh Arabic","Tahoma","Arial",sans-serif`
  ctx.shadowColor = 'rgba(255,255,255,.65)'
  ctx.shadowBlur = 10
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 2

  for (const line of matnLines) {
    ctx.fillText(line, xRight, y)
    y += matnLineH
  }

  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0

  y += gap2

  const meta = selectedHadithMeta.value
  ctx.fillStyle = 'rgba(0,0,0,.60)'
  ctx.direction = 'rtl'
  ctx.textAlign = 'right'
  ctx.font = `600 28px "Noto Kufi Arabic","Tahoma","Arial",sans-serif`
  ctx.fillText(`صحيح البخاري — حديث رقم ${meta?.sr || meta?.id || meta?.uid || ''}`, xRight, y)

  ctx.direction = 'ltr'
  ctx.textAlign = 'left'
  ctx.font = `600 26px Tahoma, Arial, sans-serif`
  ctx.fillText(getHadithShareUrl(meta?.uid || ''), xLeft, y + 2)

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 1.0))
  if (!blob) throw new Error('toBlob failed')

  const blobUrl = URL.createObjectURL(blob)
  window.open(blobUrl, '_blank')

  try {
    if (navigator?.share) {
      const file = new File([blob], `hadith_${meta?.uid || 'hadith'}.png`, { type: 'image/png' })
      if (!navigator.canShare || navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `Hadith ${meta?.uid || ''}` })
      }
    }
  } catch (_) {}
}

const exportHadithImage = async () => {
  if (!selectedHadith.value) return

  try {
    shareBusy.value = true
    await nextTick()
    await ensureFontsReady()
    await nextTick()

    if (process.client && isIOS()) {
      await exportHadithImageIOS()
      return
    }

    if (!shareCardRef.value) return

    const dataUrl = await toPng(shareCardRef.value, {
      width: 1080,
      height: 1920,
      pixelRatio: 2,
      cacheBust: true
    })

    const meta = selectedHadithMeta.value
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `hadith_${meta?.uid || selectedHadith.value.id}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
  } catch (e) {
    console.error(e)
    alert('Erreur export image')
  } finally {
    shareBusy.value = false
  }
}

// ✅ scroll hint (drawer + aside)
const drawerScrollEl = ref(null)
const asideScrollEl = ref(null)
const showDrawerScrollHint = ref(false)
const showAsideScrollHint = ref(false)

const updateScrollHint = (el, outRef) => {
  if (!el) {
    outRef.value = false
    return
  }
  const remaining = el.scrollHeight - el.scrollTop - el.clientHeight
  outRef.value = remaining > 10
}

const updateDrawerScrollHint = () => updateScrollHint(drawerScrollEl.value, showDrawerScrollHint)
const updateAsideScrollHint = () => updateScrollHint(asideScrollEl.value, showAsideScrollHint)

const scrollDrawerDown = () => {
  const el = drawerScrollEl.value
  if (!el) return
  el.scrollBy({ top: 280, behavior: 'smooth' })
  setTimeout(updateDrawerScrollHint, 250)
}

const scrollAsideDown = () => {
  const el = asideScrollEl.value
  if (!el) return
  el.scrollBy({ top: 280, behavior: 'smooth' })
  setTimeout(updateAsideScrollHint, 250)
}
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
          <NuxtLink to="/bukhari" class="flex items-center gap-3 cursor-pointer" @click="searchQuery = ''">
            <img
              src="/logo.png"
              alt="Logo"
              class="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-slate-700"
              onerror="this.style.display='none'"
            />
            <h1 class="font-serif text-2xl font-bold tracking-wide text-slate-800 dark:text-white">صحيح البخاري</h1>
          </NuxtLink>
        </div>

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

    <!-- ✅ MOBILE DRAWER + SWIPE -->
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
          <button class="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-400" @click="closeBooksMenu">
            ✕
          </button>
        </div>

        <div
          ref="drawerScrollEl"
          class="relative p-2 space-y-1 overflow-y-auto h-[calc(100%-4rem)] custom-scrollbar"
          @scroll="updateDrawerScrollHint"
        >
          <NuxtLink
            to="/bukhari"
            @click="goAllHadiths(); closeBooksMenu()"
            class="w-full text-right px-3 py-2.5 rounded-lg text-sm transition font-bold block"
            :class="
              selectedBookBf === null && !searchQuery && !showVideoOnly
                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
            "
          >
            📚 جميع الأحاديث
          </NuxtLink>

          <NuxtLink
            :to="{ path: '/bukhari', query: { videos: '1' } }"
            @click="goVideoHadiths(); closeBooksMenu()"
            class="w-full text-right px-3 py-2.5 rounded-lg text-sm transition font-bold flex justify-between items-center"
            :class="
              showVideoOnly
                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
            "
          >
            <span>🎥 أحاديث بالفيديو</span>
            <span class="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 dark:text-slate-500">
              {{ videoCountInCurrent }}
            </span>
          </NuxtLink>

          <NuxtLink
            v-for="b in books"
            :key="b.bf"
            :to="`/bukhari?book=${b.bf}`"
            @click="searchQuery = ''; showVideoOnly=false; closeBooksMenu()"
            class="w-full text-right px-3 py-2.5 rounded-lg text-sm transition flex justify-between items-center group"
            :class="
              selectedBookBf === b.bf && !showVideoOnly
                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
            "
          >
            <span class="truncate">
              {{ b.numLabel }}
              <span class="mx-1">📖</span>
              {{ b.name }}
            </span>
            <span class="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 dark:text-slate-500">
              {{ b.count }}
            </span>
          </NuxtLink>

          <button
            v-if="showDrawerScrollHint"
            type="button"
            @click.stop.prevent="scrollDrawerDown"
            class="sticky bottom-3 w-full flex justify-center pointer-events-auto"
            aria-label="المزيد من الكتب"
          >
            <span
              class="w-10 h-10 rounded-full bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 shadow flex items-center justify-center text-slate-500 dark:text-slate-200 hover:scale-105 transition"
              title="المزيد"
            >
              ⬇️
            </span>
          </button>
        </div>
      </div>
    </div>

    <main class="container mx-auto px-4 pt-24 pb-20 max-w-7xl">
      <div v-if="loading" class="flex flex-col items-center justify-center h-[60vh] animate-pulse">
        <div class="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full mb-4 flex items-center justify-center text-3xl">
          📚
        </div>
        <p>جاري تحميل المكتبة...</p>
      </div>

      <div v-else class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <aside
          class="hidden lg:block lg:col-span-3 sticky top-24 bg-white dark:bg-[#131c31] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm max-h-[80vh] overflow-hidden"
        >
          <div class="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-[#131c31] sticky top-0 z-10">
            <h3 class="font-bold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">الكتب والأبواب</h3>
          </div>

          <div
            ref="asideScrollEl"
            class="relative p-2 space-y-1 overflow-y-auto custom-scrollbar max-h-[calc(80vh-3.75rem)]"
            @scroll="updateAsideScrollHint"
          >
            <NuxtLink
              to="/bukhari"
              @click="goAllHadiths()"
              class="w-full text-right px-3 py-2.5 rounded-lg text-sm transition font-bold block"
              :class="
                selectedBookBf === null && !searchQuery && !showVideoOnly
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              "
            >
              📚 جميع الأحاديث
            </NuxtLink>

            <NuxtLink
              :to="{ path: '/bukhari', query: { videos: '1' } }"
              @click="goVideoHadiths()"
              class="w-full text-right px-3 py-2.5 rounded-lg text-sm transition font-bold flex justify-between items-center"
              :class="
                showVideoOnly
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              "
            >
              <span>🎥 أحاديث بالفيديو</span>
              <span class="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 dark:text-slate-500">
                {{ videoCountInCurrent }}
              </span>
            </NuxtLink>

            <NuxtLink
              v-for="b in books"
              :key="b.bf"
              :to="`/bukhari?book=${b.bf}`"
              @click="searchQuery = ''; showVideoOnly=false"
              class="w-full text-right px-3 py-2.5 rounded-lg text-sm transition flex justify-between items-center group"
              :class="
                selectedBookBf === b.bf && !showVideoOnly
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              "
            >
              <span class="truncate">
                {{ b.numLabel }}
                <span class="mx-1">📖</span>
                {{ b.name }}
              </span>
              <span class="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 dark:text-slate-500">
                {{ b.count }}
              </span>
            </NuxtLink>

            <button
              v-if="showAsideScrollHint"
              type="button"
              @click.stop.prevent="scrollAsideDown"
              class="sticky bottom-3 w-full flex justify-center pointer-events-auto"
              aria-label="المزيد من الكتب"
            >
              <span
                class="w-10 h-10 rounded-full bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 shadow flex items-center justify-center text-slate-500 dark:text-slate-200 hover:scale-105 transition"
                title="المزيد"
              >
                ⬇️
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
                placeholder="ابحث عن كلمة (مثال: النية، رمضان) أو رقم الحديث... أو UID مثل 24-5"
                class="w-full p-5 pl-12 bg-transparent rounded-2xl outline-none text-lg font-medium text-slate-800 dark:text-white"
              />
              <span class="absolute left-4 top-1/2 -translate-y-1/2 text-2xl opacity-30">🔍</span>
              <button
                v-if="searchQuery"
                @click="searchQuery = ''"
                class="absolute left-12 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 p-1"
              >
                ✕
              </button>
            </div>
          </div>

          <div class="space-y-6">
            <div
              v-for="h in paginatedList"
              :key="h.uid || h.id"
              class="bg-white dark:bg-[#131c31] rounded-[2rem] p-1 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all duration-300 group cursor-pointer"
              @click="openDetails(h, $event)"
            >
              <div class="bg-white dark:bg-[#131c31] rounded-[1.8rem] p-6 sm:p-8">
                <div class="flex justify-between items-start mb-6 border-b border-slate-50 dark:border-slate-800 pb-4">
                  <div class="flex flex-wrap gap-2 items-center">
                    <span class="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold px-3 py-1 rounded-lg font-mono">
                      #{{ h.sr || h.id || h.uid }}
                    </span>

                    <span
                      class="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold px-3 py-1 rounded-lg border border-emerald-100 dark:border-emerald-900/30"
                    >
                      {{ h.c }}
                    </span>

                    <button
                      v-if="h.has_video"
                      @click.stop="openDetails(h, $event)"
                      class="flex items-center gap-1 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-[10px] font-bold px-2 py-1 rounded-lg border border-red-100 dark:border-red-900/30 animate-pulse cursor-pointer hover:scale-105 transition"
                      title="فيديو متوفر"
                    >
                      <span>▶</span> فيديو
                    </button>
                  </div>
                </div>

                <div v-html="renderHadith(h.t)"></div>

                <div class="mt-6 pt-4 border-t border-slate-50 dark:border-slate-800 flex justify-end gap-3 items-center text-sm font-bold text-slate-400 group-hover:text-emerald-600 transition-colors">
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

            <div class="px-6 py-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm font-bold text-slate-600 dark:text-slate-300 font-mono">
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
            <div class="flex items-center gap-3">
              <h3 class="text-xl font-bold text-slate-800 dark:text-white">
                حديث رقم {{ selectedHadithMeta?.sr || selectedHadithMeta?.id || selectedHadithMeta?.uid || '...' }}
              </h3>

              <NuxtLink
                v-if="selectedHadithMeta?.uid"
                :to="`/bukhari/${selectedHadithMeta.uid}`"
                target="_blank"
                class="text-xs bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full text-slate-500 hover:text-emerald-600 transition"
              >
                🔗 صفحة مستقلة
              </NuxtLink>

              <button
                v-if="selectedHadith"
                @click="exportHadithImage"
                :disabled="shareBusy"
                class="text-xs bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1 rounded-full text-emerald-700 dark:text-emerald-400 hover:opacity-80 transition disabled:opacity-50"
                title="التقاط صورة للحديث"
              >
                📷 التقاط صورة
              </button>
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
              <div
                v-if="selectedHadith.youtube_id"
                class="mx-auto rounded-2xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-700 bg-black"
                :class="selectedHadith.is_short ? 'max-w-[300px] aspect-[9/16]' : 'w-full aspect-video'"
              >
                <iframe :src="`https://www.youtube.com/embed/${selectedHadith.youtube_id}`" class="w-full h-full" frameborder="0" allowfullscreen />
              </div>

              <div
                v-if="selectedHadith.audio_url"
                class="bg-white dark:bg-[#131c31] p-4 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center gap-4 shadow-sm"
              >
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

            <div v-else class="py-16 text-center text-slate-400">⚠️ لم يتم العثور على الحديث.</div>
          </div>
        </div>
      </div>

      <!-- ✅ OFFSCREEN SHARE CARD (Desktop/Android) -->
      <div
        class="fixed opacity-0 pointer-events-none"
        :style="isIOS() ? { left: '0px', top: '0px', zIndex: -10 } : { left: '-99999px', top: '0px' }"
      >
        <div ref="shareCardRef" class="relative overflow-hidden" :style="{ width: '1080px', height: '1920px', direction: 'rtl' }">
          <img :src="SHARE_BG_URL" class="absolute inset-0 w-full h-full object-cover" alt="" draggable="false" />

          <div class="relative z-[1] w-full h-full">
            <template v-if="selectedHadith">
              <template v-for="(v, k) in [getShareLayout(selectedHadith.text_chakl)]" :key="k">
                <div
                  class="absolute left-0 right-0"
                  :style="{
                    top: '360px',
                    bottom: '300px',
                    padding: `0 ${v.padX}px`,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: v.vAlign
                  }"
                >
                  <div
                    v-if="v.sanad"
                    class="text-justify"
                    :style="{
                      fontFamily: `'Noto Kufi Arabic','Tahoma','Arial',sans-serif`,
                      fontSize: v.sanadSize + 'px',
                      lineHeight: v.sanadLH,
                      color: 'rgba(0,0,0,.60)',
                      fontWeight: 600
                    }"
                  >
                    {{ v.sanad }}
                  </div>

                  <div
                    class="mt-8 text-justify"
                    :style="{
                      fontFamily: `'Amiri','Noto Naskh Arabic','Tahoma','Arial',sans-serif`,
                      fontSize: v.matnSize + 'px',
                      lineHeight: v.matnLH,
                      color: '#000',
                      fontWeight: 800,
                      textShadow: '0 2px 10px rgba(255,255,255,.65)'
                    }"
                  >
                    {{ v.matn }}
                  </div>

                  <div class="mt-10 flex items-center justify-between">
                    <div
                      :style="{
                        fontFamily: `'Noto Kufi Arabic','Tahoma','Arial',sans-serif`,
                        fontSize: '28px',
                        color: 'rgba(0,0,0,.60)'
                      }"
                    >
                      صحيح البخاري — حديث رقم {{ selectedHadithMeta?.sr || selectedHadithMeta?.id || selectedHadithMeta?.uid || '' }}
                    </div>

                    <div
                      :style="{
                        direction: 'ltr',
                        fontFamily: `Tahoma, Arial, sans-serif`,
                        fontSize: '26px',
                        color: 'rgba(0,0,0,.60)'
                      }"
                    >
                      {{ getHadithShareUrl(selectedHadithMeta?.uid || '') }}
                    </div>
                  </div>
                </div>
              </template>
            </template>
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
