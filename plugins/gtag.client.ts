export default defineNuxtPlugin((nuxtApp) => {
  const id = 'G-P7J0S59D58'

  const sendPageView = () => {
    const gtag = (window as any).gtag
    if (typeof gtag !== 'function') return

    gtag('config', id, {
      page_path: window.location.pathname + window.location.search,
      page_title: document.title
    })
  }

  // À chaque navigation Nuxt (SPA)
  nuxtApp.hook('page:finish', sendPageView)
})
