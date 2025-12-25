<script setup>
import { toPng } from 'html-to-image'

const route = useRoute()

// slug peut être "22-17" (canonique) ou "1237" (ancien alias)
const slug = String(route.params.id || '').trim()

/* =========================
   ✅ DARK MODE
========================= */
const isDark = ref(false)

onMounted(() => {
  try {
    const savedTheme = localStorage.getItem('theme')
    if (
      savedTheme === 'dark' ||
      (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)
    ) {
      isDark.value = true
      document.documentElement.classList.add('dark')
    }
  } catch (_) {}
})

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

/**
 * ✅ Lecture SAFE des JSON depuis /public
 * - client : fetch HTTP normal
 * - server / generate / preview : lecture directe du disque
 */
const readPublicJson = async (relPath) => {
  if (process.client) {
    return await $fetch('/' + relPath)
  }

  const { readFile } = await import('node:fs/promises')
  const { join } = await import('node:path')

  const candidates = [
    join(process.cwd(), 'public', relPath), // dev
    join(process.cwd(), '.output/public', relPath) // preview / prod
  ]

  for (const filePath of candidates) {
    try {
      const txt = await readFile(filePath, 'utf8')
      return JSON.parse(txt)
    } catch (e) {
      // try next path
    }
  }

  throw new Error(`Fichier introuvable: ${relPath}`)
}

const parseUid = (u) => {
  const m = /^(\d+)-(\d+)$/.exec(String(u || '').trim())
  if (!m) return null
  return { bf: Number(m[1]), bi: Number(m[2]) }
}

const isNumericOnly = (v) => /^\d+$/.test(String(v || '').trim())

// ✅ Strip tashkīl (تشكيل)
const stripTashkil = (str = '') => String(str).replace(/[\u064B-\u065F\u0670]/g, '')

// ✅ util: safe string compare for ids (number/string)
const eqId = (a, b) => String(a ?? '').trim() !== '' && String(a ?? '') === String(b ?? '')

// --- 1) CHARGEMENT HADITH ---
const { data: payload, error } = await useAsyncData(`hadith-${slug}`, async () => {
  try {
    // 1️⃣ index
    const index = await readPublicJson('data/bukhari/index_min.json')
    if (!Array.isArray(index)) throw new Error('Index invalide')

    let meta = null
    const uidParsed = parseUid(slug)

    // ✅ Canonique: /bukhari/22-17
    if (uidParsed) {
      meta = index.find((h) => String(h.uid) === slug)
      if (!meta) throw new Error(`UID ${slug} introuvable`)
    }
    // ✅ Alias legacy: /bukhari/1237
    else if (isNumericOnly(slug)) {
      const matches = index.filter((h) => h.id != null && String(h.id) === slug)
      if (!matches.length) throw new Error(`ID ${slug} introuvable`)
      meta = matches[0]
    } else {
      throw new Error('Format URL غير صالح')
    }

    // 2️⃣ livre
    const book = await readPublicJson(`data/bukhari/books/${meta.bf}.json`)
    if (!Array.isArray(book)) throw new Error(`Livre ${meta.bf} invalide`)

    // 3️⃣ hadith final
    let found = null
    if (Number.isInteger(meta.bi) && book[meta.bi]) found = book[meta.bi]
    else found = book.find((h) => eqId(h?.id, meta.id))

    if (!found) throw new Error(`Hadith introuvable dans le livre ${meta.bf} (bi=${meta.bi})`)

    return { hadith: found, meta }
  } catch (e) {
    console.error('Erreur SSR:', e)
    throw createError({
      statusCode: 404,
      statusMessage: e.message || 'Hadith non trouvé',
      fatal: false
    })
  }
})

const hadith = computed(() => payload.value?.hadith || null)
const meta = computed(() => payload.value?.meta || null)

// ✅ books_meta.json (noms des livres)
const { data: booksMeta } = await useAsyncData('bukhari-books-meta', async () => {
  return await readPublicJson('data/bukhari/books_meta.json')
})

// ✅ Lien du bouton livre → /bukhari?book=bf
const bookLink = computed(() => {
  const bf = meta.value?.bf
  return bf ? `/bukhari?book=${bf}` : '/bukhari'
})

const bookNameAr = computed(() => {
  const bf = meta.value?.bf
  if (!bf) return ''
  const key = String(bf)
  return booksMeta.value?.[key]?.ar || `الكتاب ${bf}`
})

// ✅ Redirect client si on est sur l'ancien format /bukhari/1237
watchEffect(async () => {
  if (!process.client) return
  if (!meta.value?.uid) return
  if (slug !== meta.value.uid && isNumericOnly(slug)) {
    await navigateTo(`/bukhari/${meta.value.uid}`, { replace: true })
  }
})

/**
 * ✅ Sépare sanad/matn
 */
const splitSanadMatn = (text) => {
  if (!text) return { sanad: '', matn: '' }

  const regex =
    /((?:صَلَّى.*?وَسَلَّمَ|صلى الله عليه وسلم)(?:\s+(?:يَقُولُ|قَالَ|يُحَدِّثُ|خَطَبَ|يقول|قال|يحدث))?)/

  const match = text.match(regex)

  if (match && match.index > 0) {
    const splitIdx = match.index + match[0].length
    return {
      sanad: text.substring(0, splitIdx),
      matn: text.substring(splitIdx).trim()
    }
  }

  return { sanad: '', matn: String(text).trim() }
}

const ellipsis = (s, max = 90) => {
  const str = String(s || '').trim().replace(/\s+/g, ' ')
  if (!str) return ''
  if (str.length <= max) return str
  return str.slice(0, max).trimEnd() + '…'
}

const titleFromMatnArNoTashkil = computed(() => {
  const text = hadith.value?.text_chakl || ''
  const { matn } = splitSanadMatn(text)
  const start = ellipsis(matn, 110)
  return stripTashkil(start)
})

// --- 2) RENDER HADITH (SANAD + MATN) ---
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
      <div class="text-sm leading-loose text-slate-500 dark:text-slate-400 mb-6 font-sanad text-justify pr-4">
        ${formattedSanad}
      </div>
      <div class="bg-slate-50 dark:bg-[#0B1120] p-6 rounded-2xl border border-slate-100 dark:border-slate-800 border-r-4 border-emerald-200 dark:border-r-emerald-400 mt-2">
        <p class="text-3xl font-serif leading-[2.8] text-slate-900 dark:text-white font-bold text-justify pr-4">
          ${matn}
        </p>
      </div>
    `
  }

  return `
    <p class="text-3xl font-serif leading-[2.8] text-slate-900 dark:text-white font-bold text-justify">
      ${text}
    </p>
  `
}

// --- 3) SEO ---
useHead(() => {
  const displayNumber = meta.value?.sr || meta.value?.id || meta.value?.uid || slug
  const canonicalPath = meta.value?.uid ? `/bukhari/${meta.value.uid}` : `/bukhari/${slug}`

  const arSeo = (titleFromMatnArNoTashkil.value || '').trim()
  const enTitle = (hadith.value?.english_text || '').trim()

  const bestTitle = (arSeo || enTitle || `حديث رقم ${displayNumber}`).trim()
  const descFallback = (enTitle || arSeo || stripTashkil(hadith.value?.text_chakl || '')).replace(/\s+/g, ' ')
  const description = descFallback.slice(0, 180)

  return {
    title: `${bestTitle} - صحيح البخاري #${displayNumber}`.trim(),
    meta: [{ name: 'description', content: description }],
    link: [{ rel: 'canonical', href: canonicalPath }]
  }
})

/* =========================
   ✅ COPY (WEB + iPhone)
========================= */
const copied = ref(false)

const getHadithShareUrl = (uid) => {
  if (uid) return `https://alsa7i7.com/bukhari/${uid}`
  return process.client ? window.location.href : ''
}

const buildCopyText = () => {
  const h = hadith.value
  const m = meta.value
  const num = m?.sr || m?.id || m?.uid || slug
  const uid = m?.uid || ''
  const url = getHadithShareUrl(uid)

  const ar = h?.text_chakl || ''
  const en = h?.english_text || ''
  const book = bookNameAr.value || ''

  let out = `صحيح البخاري #${num}\n${book}\n\n${ar}`.trim()

  if (en) out += `\n\n---\n${en}`
  if (url) out += `\n\n${url}`

  return out
}

const fallbackCopy = async (text) => {
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.position = 'fixed'
  ta.style.top = '-9999px'
  ta.style.left = '-9999px'
  document.body.appendChild(ta)
  ta.select()
  ta.setSelectionRange(0, ta.value.length)
  document.execCommand('copy')
  ta.remove()
}

const copyHadith = async () => {
  try {
    if (!process.client) return
    const text = buildCopyText()

    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
    } else {
      await fallbackCopy(text)
    }

    copied.value = true
    setTimeout(() => (copied.value = false), 1200)
  } catch (e) {
    console.error(e)
    alert('تعذر النسخ')
  }
}

/* =========================
   ✅ SHARE (Link/Text) — Web + iPhone
========================= */
const shareBusy2 = ref(false)

const buildSharePayload = () => {
  const m = meta.value
  const h = hadith.value
  const num = m?.sr || m?.id || m?.uid || slug
  const uid = m?.uid || ''
  const url = getHadithShareUrl(uid)
  const book = bookNameAr.value || ''

  const ar = (h?.text_chakl || '').trim()
  const en = (h?.english_text || '').trim()

  const shortAr = ar.length > 700 ? ar.slice(0, 700).trimEnd() + '…' : ar
  const shortEn = en ? (en.length > 500 ? en.slice(0, 500).trimEnd() + '…' : en) : ''

  const text = [`صحيح البخاري #${num}`, book, '', shortAr, shortEn ? `\n---\n${shortEn}` : '', '', url]
    .filter(Boolean)
    .join('\n')

  const title = `صحيح البخاري #${num}`
  return { title, text, url }
}

const shareHadith = async () => {
  try {
    if (!process.client) return
    if (!hadith.value || !meta.value) return

    shareBusy2.value = true

    const { title, text, url } = buildSharePayload()

    if (navigator?.share) {
      try {
        await navigator.share({ title, text, url })
        return
      } catch (e) {
        const shortText = text.slice(0, 350)
        await navigator.share({ title, text: shortText, url })
        return
      }
    }

    // fallback desktop
    await copyHadith()
  } catch (e) {
    console.error(e)
    alert('تعذر المشاركة')
  } finally {
    shareBusy2.value = false
  }
}

/* =========================
   ✅ SHARE CARD (IMAGE EXPORT)
========================= */
const shareCardRef = ref(null)
const shareBusy = ref(false)
const SHARE_BG_URL = '/share/bg1080x1920.png'

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
  const h = hadith.value
  const m = meta.value
  if (!h || !m) return

  const newTab = window.open('', '_blank')

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

  const num = m?.sr || m?.id || m?.uid || ''
  const uid = m?.uid || ''
  const url = getHadithShareUrl(uid)

  ctx.fillStyle = 'rgba(0,0,0,.60)'
  ctx.direction = 'rtl'
  ctx.textAlign = 'right'
  ctx.font = `600 28px "Noto Kufi Arabic","Tahoma","Arial",sans-serif`
  ctx.fillText(`صحيح البخاري — حديث رقم ${num}`, xRight, y)

  ctx.direction = 'ltr'
  ctx.textAlign = 'left'
  ctx.font = `600 26px Tahoma, Arial, sans-serif`
  ctx.fillText(url, xLeft, y + 2)

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 1.0))
  if (!blob) throw new Error('toBlob failed')

  const blobUrl = URL.createObjectURL(blob)
  if (newTab) newTab.location.href = blobUrl
  else window.open(blobUrl, '_blank')

  try {
    if (navigator?.share) {
      const file = new File([blob], `hadith_${uid || 'hadith'}.png`, { type: 'image/png' })
      if (!navigator.canShare || navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `Hadith ${uid || ''}` })
      }
    }
  } catch (_) {}
}

const exportHadithImage = async () => {
  if (!hadith.value || !meta.value) return

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

    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `hadith_${meta.value?.uid || meta.value?.id || 'hadith'}.png`
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
</script>

<template>
  <div
    class="min-h-screen bg-slate-50 dark:bg-[#0B1120] dir-rtl font-sans py-10 px-4 flex justify-center text-slate-800 dark:text-slate-100 transition-colors duration-300"
  >
    <div
      v-if="hadith"
      class="w-full max-w-4xl bg-white dark:bg-[#131c31] rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden"
    >
      <!-- HEADER -->
      <div
        class="bg-slate-50 dark:bg-[#0f172a] px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center sticky top-0 z-10"
      >
        <NuxtLink
          to="/bukhari"
          class="flex items-center gap-2 text-slate-500 dark:text-slate-300 hover:text-emerald-600 font-bold transition"
        >
          ➡ العودة للفهرس
        </NuxtLink>

        <!-- Right side -->
        <div class="flex items-center gap-2 flex-wrap justify-end">
          <h1 class="font-bold text-lg text-emerald-800 dark:text-emerald-300">
            صحيح البخاري
            <span class="bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 rounded text-sm ml-2">
              #{{ meta?.sr || meta?.id || meta?.uid || slug }}
            </span>
          </h1>

          

          <!-- ✅ Bouton livre -->
          <NuxtLink
            v-if="meta?.bf"
            :to="bookLink"
            class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/30
                   text-emerald-800 dark:text-emerald-200 hover:text-emerald-900 hover:border-emerald-300 transition
                   text-sm font-sanad"
            :title="`عرض أحاديث ${bookNameAr}`"
          >
            <span>📚</span>
            <span dir="rtl">{{ bookNameAr }}</span>
          </NuxtLink>

          <!-- ✅ Share -->
          <button
            type="button"
            @click="shareHadith"
            :disabled="shareBusy2"
            class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/30
                   text-slate-700 dark:text-slate-200 hover:text-emerald-700 hover:border-emerald-200 transition text-sm font-sanad
                   disabled:opacity-50"
            title="مشاركة الحديث"
          >
            <span>📤</span>
            <span>{{ shareBusy2 ? '...' : 'مشاركة' }}</span>
          </button>

          <!-- ✅ Copy -->
          <button
            type="button"
            @click="copyHadith"
            class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/30
                   text-slate-700 dark:text-slate-200 hover:text-emerald-700 hover:border-emerald-200 transition text-sm font-sanad"
            :title="copied ? 'تم النسخ' : 'نسخ الحديث'"
          >
            <span>📋</span>
            <span>{{ copied ? 'تم النسخ' : 'نسخ' }}</span>
          </button>

          <!-- ✅ Capture image -->
          <button
            type="button"
            @click="exportHadithImage"
            :disabled="shareBusy"
            class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/30
                   text-slate-700 dark:text-slate-200 hover:text-emerald-700 hover:border-emerald-200 transition text-sm font-sanad
                   disabled:opacity-50"
            title="📷 التقاط صورة"
          >
            <span>📷</span>
            <span>{{ shareBusy ? '...' : 'التقاط صورة' }}</span>
          </button>

          <!-- ✅ Dark mode -->
          <button
            type="button"
            @click="toggleTheme"
            class="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-yellow-400 flex items-center justify-center hover:scale-110 transition border border-slate-200 dark:border-slate-700"
            title="الوضع الليلي"
          >
            <span v-if="isDark">☀️</span><span v-else>🌙</span>
          </button>
        </div>
      </div>

      <!-- CONTENU -->
      <div class="p-8 md:p-12 space-y-10">
        <div class="px-2">
          <h2
            v-if="titleFromMatnArNoTashkil"
            class="mx-auto max-w-2xl text-center font-serif text-base md:text-lg font-semibold text-slate-700 dark:text-slate-200 leading-relaxed"
          >
            {{ titleFromMatnArNoTashkil }}
          </h2>

          <p
            v-if="hadith.english_text"
            class="mx-auto mt-2 max-w-2xl text-center text-xs md:text-sm text-slate-400"
            dir="ltr"
          >
            {{ ellipsis(hadith.english_text, 110) }}
          </p>
        </div>

        <div
          v-if="hadith.youtube_id"
          class="mx-auto rounded-2xl overflow-hidden shadow-lg bg-black border border-slate-200 dark:border-slate-700"
          :class="hadith.is_short ? 'max-w-sm aspect-[9/16]' : 'w-full aspect-video'"
        >
          <iframe
            :src="`https://www.youtube.com/embed/${hadith.youtube_id}`"
            class="w-full h-full"
            frameborder="0"
            allowfullscreen
          />
        </div>

        <div
          v-if="hadith.audio_url"
          class="bg-white dark:bg-[#0f172a] p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-4 shadow-sm"
        >
          <span class="text-2xl text-emerald-600 dark:text-emerald-400">🔊</span>
          <audio controls :src="hadith.audio_url" class="w-full h-8" />
        </div>

        <div v-html="renderHadith(hadith.text_chakl)"></div>

        <div
          v-if="hadith.english_text"
          class="bg-slate-50 dark:bg-[#0f172a] p-6 rounded-2xl text-left border border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-sm"
          dir="ltr"
        >
          <strong class="block text-emerald-600 dark:text-emerald-400 text-xs uppercase mb-2">
            English Translation
          </strong>
          {{ hadith.english_text }}
        </div>

        <div
          v-if="hadith.explication"
          class="bg-emerald-50/50 dark:bg-emerald-900/10 p-8 rounded-3xl border border-emerald-100 dark:border-emerald-900/30"
        >
          <h3 class="font-bold text-emerald-800 dark:text-emerald-300 mb-4 text-xl">💡 شرح فتح الباري</h3>
          <p class="text-lg leading-loose text-justify text-slate-700 dark:text-slate-200 font-serif">
            {{ hadith.explication }}
          </p>
        </div>
      </div>
    </div>

    <!-- ERREUR -->
    <div v-else-if="error" class="text-center py-40">
      <div class="text-4xl mb-4">⚠️</div>
      <p class="text-xl text-slate-500 dark:text-slate-300 mb-6">عذراً، الحديث ({{ slug }}) غير متوفر.</p>
      <NuxtLink to="/bukhari" class="text-emerald-600 underline mt-4 block">العودة للرئيسية</NuxtLink>
    </div>

    <!-- LOADER -->
    <div v-else class="text-center py-40 animate-pulse text-slate-400">
      <div class="text-4xl mb-4">📖</div>
      <p class="text-xl">جاري تحميل الحديث...</p>
    </div>

    <!-- ✅ OFFSCREEN SHARE CARD (Web/Android) -->
    <div
      class="fixed opacity-0 pointer-events-none"
      :style="isIOS() ? { left: '0px', top: '0px', zIndex: -10 } : { left: '-99999px', top: '0px' }"
    >
      <div
        ref="shareCardRef"
        class="relative overflow-hidden"
        :style="{ width: '1080px', height: '1920px', direction: 'rtl' }"
      >
        <img :src="SHARE_BG_URL" class="absolute inset-0 w-full h-full object-cover" alt="" draggable="false" />

        <div class="relative z-[1] w-full h-full">
          <template v-if="hadith">
            <template v-for="(v, k) in [getShareLayout(hadith.text_chakl)]" :key="k">
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
                    صحيح البخاري — حديث رقم {{ meta?.sr || meta?.id || meta?.uid || '' }}
                  </div>

                  <div
                    :style="{
                      direction: 'ltr',
                      fontFamily: `Tahoma, Arial, sans-serif`,
                      fontSize: '26px',
                      color: 'rgba(0,0,0,.60)'
                    }"
                  >
                    {{ getHadithShareUrl(meta?.uid || '') }}
                  </div>
                </div>
              </div>
            </template>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.font-serif {
  font-family: 'Amiri', serif;
}
.font-sanad {
  font-family: 'Noto Kufi Arabic', sans-serif;
}
.dir-rtl {
  direction: rtl;
}
</style>
