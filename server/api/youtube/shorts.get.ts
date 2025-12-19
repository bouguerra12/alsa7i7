// server/api/youtube/shorts.get.ts
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const key = config.ytApiKey

  if (!key) {
    setResponseStatus(event, 500)
    return { error: 'Missing YT_API_KEY (runtimeConfig.ytApiKey)' }
  }

  // ✅ Mets ici TON channelId (format UC...)
  const CHANNEL_ID = 'UCvf66KiiFwxLnDQ_d0djykA'

  // ✅ Cache (Vercel/CDN) : 15 min + stale revalidate
  setHeader(event, 'Cache-Control', 'public, s-maxage=900, stale-while-revalidate=86400')

  // 1) Chercher les vidéos les plus récentes de la chaîne
  const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search')
  searchUrl.searchParams.set('key', key)
  searchUrl.searchParams.set('part', 'snippet')
  searchUrl.searchParams.set('channelId', CHANNEL_ID)
  searchUrl.searchParams.set('order', 'date')
  searchUrl.searchParams.set('type', 'video')
  searchUrl.searchParams.set('maxResults', '15')

  const searchRes = await $fetch<any>(searchUrl.toString())
  const ids: string[] = (searchRes?.items || [])
    .map((it: any) => it?.id?.videoId)
    .filter(Boolean)

  if (!ids.length) return []

  // 2) Charger détails (durée + titre + thumbnails)
  const videosUrl = new URL('https://www.googleapis.com/youtube/v3/videos')
  videosUrl.searchParams.set('key', key)
  videosUrl.searchParams.set('part', 'contentDetails,snippet')
  videosUrl.searchParams.set('id', ids.join(','))

  const videosRes = await $fetch<any>(videosUrl.toString())
  const items = (videosRes?.items || []) as any[]

  // ISO 8601 duration PT#H#M#S -> secondes
  const isoToSec = (iso: string): number => {
    const m = iso?.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/)
    if (!m) return 0
    const h = m[1] ? parseInt(m[1], 10) : 0
    const min = m[2] ? parseInt(m[2], 10) : 0
    const s = m[3] ? parseInt(m[3], 10) : 0
    return h * 3600 + min * 60 + s
  }

  // 3) Filtrer shorts (< 60s) + trier par date + garder 3
  const shorts = items
    .map((v) => {
      const id = v?.id
      const publishedAt = v?.snippet?.publishedAt || ''
      const title = v?.snippet?.title || ''
      const durationIso = v?.contentDetails?.duration || ''
      const durationSec = isoToSec(durationIso)

      // ✅ Thumbs: prefer maxres > standard > high > medium > default
      // + fallback to ytimg maxres/sd/hq
      const thumb =
        v?.snippet?.thumbnails?.maxres?.url ||
        v?.snippet?.thumbnails?.standard?.url ||
        v?.snippet?.thumbnails?.high?.url ||
        v?.snippet?.thumbnails?.medium?.url ||
        v?.snippet?.thumbnails?.default?.url ||
        `https://i.ytimg.com/vi/${id}/maxresdefault.jpg` ||
        `https://i.ytimg.com/vi/${id}/sddefault.jpg` ||
        `https://i.ytimg.com/vi/${id}/hqdefault.jpg`

      return {
        id,
        title,
        publishedAt,
        durationSec,
        url: `https://www.youtube.com/shorts/${id}`,
        embed: `https://www.youtube.com/embed/${id}`,
        thumb,
      }
    })
    .filter((x) => x.id && x.durationSec > 0 && x.durationSec < 60)
    .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1))
    .slice(0, 3)

  return shorts
})
