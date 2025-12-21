<script setup>
const route = useRoute()

// slug peut être "22-17" (canonique) ou "1237" (ancien alias)
const slug = String(route.params.id || '').trim()

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

// --- 1. CHARGEMENT + SEO ---
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
    // ✅ Alias legacy: /bukhari/1237 (peut être doublonné → on prend le 1er)
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

    // 3️⃣ hadith final (déterministe)
    const found =
      Number.isInteger(meta.bi) && book[meta.bi] ? book[meta.bi] : book.find((h) => h.id == meta.id)

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

// ✅ Redirect client si on est sur l'ancien format /bukhari/1237
watchEffect(async () => {
  if (!process.client) return
  if (!meta.value?.uid) return

  // si l'URL actuelle n'est pas déjà uid, on replace
  if (slug !== meta.value.uid && isNumericOnly(slug)) {
    await navigateTo(`/bukhari/${meta.value.uid}`, { replace: true })
  }
})

// --- 2. AFFICHAGE (SANAD + MATN) ---
const renderHadith = (text) => {
  if (!text) return ''

  const regex =
    /((?:صَلَّى.*?وَسَلَّمَ|صلى الله عليه وسلم)(?:\s+(?:يَقُولُ|قَالَ|يُحَدِّثُ|خَطَبَ|يقول|قال|يحدث))?)/

  const match = text.match(regex)

  if (match && match.index > 0) {
    const splitIdx = match.index + match[0].length
    const sanad = text.substring(0, splitIdx)
    const matn = text.substring(splitIdx)

    const formattedSanad = sanad.replace(regex, '<span class="text-emerald-600 font-bold">$1</span>')

    return `
      <div class="text-sm leading-loose text-slate-500 mb-6 font-sanad text-justify pr-4">
        ${formattedSanad}
      </div>
      <div class="bg-slate-50 p-6 rounded-2xl border border-slate-100 border-r-4 border-emerald-200 mt-2">
        <p class="text-3xl font-serif leading-[2.8] text-slate-900 font-bold text-justify pr-4">
          ${matn}
        </p>
      </div>
    `
  }

  return `
    <p class="text-3xl font-serif leading-[2.8] text-slate-900 font-bold text-justify">
      ${text}
    </p>
  `
}

// --- 3. SEO ---
useHead(() => {
  const displayNumber = meta.value?.sr || meta.value?.id || meta.value?.uid || slug
  const canonical = meta.value?.uid ? `/bukhari/${meta.value.uid}` : `/bukhari/${slug}`

  return {
    title: hadith.value ? `حديث رقم ${displayNumber} - صحيح البخاري` : 'غير موجود',
    meta: [
      {
        name: 'description',
        content: hadith.value?.text_chakl?.substring(0, 160) || ''
      }
    ],
    link: [{ rel: 'canonical', href: canonical }]
  }
})
</script>

<template>
  <div class="min-h-screen bg-slate-50 dir-rtl font-sans py-10 px-4 flex justify-center">
    <div
      v-if="hadith"
      class="w-full max-w-4xl bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden"
    >
      <!-- HEADER -->
      <div class="bg-slate-50 px-6 py-4 border-b flex justify-between items-center sticky top-0 z-10">
        <NuxtLink
          to="/bukhari"
          class="flex items-center gap-2 text-slate-500 hover:text-emerald-600 font-bold transition"
        >
          ➡ العودة للفهرس
        </NuxtLink>

        <h1 class="font-bold text-lg text-emerald-800">
          صحيح البخاري
          <span class="bg-emerald-100 px-2 py-0.5 rounded text-sm ml-2">
            #{{ meta?.sr || meta?.id || meta?.uid || slug }}
          </span>
        </h1>
      </div>

      <!-- CONTENU -->
      <div class="p-8 md:p-12 space-y-10">
        <div
          v-if="hadith.youtube_id"
          class="mx-auto rounded-2xl overflow-hidden shadow-lg bg-black"
          :class="hadith.is_short ? 'max-w-sm aspect-[9/16]' : 'w-full aspect-video'"
        >
          <iframe
            :src="`https://www.youtube.com/embed/${hadith.youtube_id}`"
            class="w-full h-full"
            frameborder="0"
            allowfullscreen
          />
        </div>

        <div v-if="hadith.audio_url" class="bg-white p-4 rounded-xl border flex items-center gap-4 shadow-sm">
          <span class="text-2xl text-emerald-600">🔊</span>
          <audio controls :src="hadith.audio_url" class="w-full h-8" />
        </div>

        <div v-html="renderHadith(hadith.text_chakl)"></div>

        <div
          v-if="hadith.english_text"
          class="bg-slate-50 p-6 rounded-2xl text-left border border-slate-100 text-slate-600 text-sm"
          dir="ltr"
        >
          <strong class="block text-emerald-600 text-xs uppercase mb-2"> English Translation </strong>
          {{ hadith.english_text }}
        </div>

        <div v-if="hadith.explication" class="bg-emerald-50/50 p-8 rounded-3xl border border-emerald-100">
          <h3 class="font-bold text-emerald-800 mb-4 text-xl">💡 شرح فتح الباري</h3>
          <p class="text-lg leading-loose text-justify text-slate-700 font-serif">
            {{ hadith.explication }}
          </p>
        </div>
      </div>
    </div>

    <!-- ERREUR -->
    <div v-else-if="error" class="text-center py-40">
      <div class="text-4xl mb-4">⚠️</div>
      <p class="text-xl text-slate-500 mb-6">
        عذراً، الحديث ({{ slug }}) غير متوفر.
      </p>
      <NuxtLink to="/bukhari" class="text-emerald-600 underline mt-4 block">
        العودة للرئيسية
      </NuxtLink>
    </div>

    <!-- LOADER -->
    <div v-else class="text-center py-40 animate-pulse text-slate-400">
      <div class="text-4xl mb-4">📖</div>
      <p class="text-xl">جاري تحميل الحديث...</p>
    </div>
  </div>
</template>
