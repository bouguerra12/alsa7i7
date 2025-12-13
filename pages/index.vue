<script setup>
useSeoMeta({
  title: 'Al-Sahih - المنصة الحديثية',
  description: 'موسوعة الأحاديث النبوية الشريفة',
})

const books = [
  { id: 'bukhari', title: 'Sahih Al-Bukhari', arabic: 'صحيح البخاري', color: 'bg-emerald-600', link: '/bukhari', available: true },
  { id: 'muslim', title: 'Sahih Muslim', arabic: 'صحيح مسلم', color: 'bg-blue-600', link: '/muslim', available: false }, // Mettre available: true quand Muslim sera prêt
]
</script>

<template>
  <div class="min-h-screen bg-slate-50 dir-rtl font-sans text-slate-800 flex flex-col items-center justify-center">
    
    <header class="text-center mb-12 flex flex-col items-center">
      
      <!-- Logo -->
      <img
        src="/logo.png"
        alt="Al-Sahih Logo"
        class="w-24 h-24 mb-6"
        loading="eager"
      />

     
        <span class="block text-lg md:text-xl font-normal text-slate-600 mt-2">
          تهتم بنشر الأحاديث النبوية الصحيحة من كتب السنة الموثوقة
        </span>
      


      <p class="text-slate-500 text-lg">
        اختر الكتاب الذي تريد البحث فيه
      </p>
    </header>


    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl w-full px-4">
      
      <NuxtLink to="/bukhari" class="bg-white rounded-3xl p-8 shadow-lg border border-emerald-100 hover:shadow-2xl hover:border-emerald-300 transition group cursor-pointer flex flex-col items-center text-center">
        <div class="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-4xl mb-4 group-hover:scale-110 transition">📗</div>
        <h2 class="text-2xl font-bold text-emerald-800 mb-1">صحيح البخاري</h2>
        <span class="text-sm text-emerald-600 font-bold bg-emerald-50 px-3 py-1 rounded-full mt-2">متوفر الان</span>
      </NuxtLink>

      <NuxtLink to="/muslim" class="bg-white rounded-3xl p-8 shadow-lg border border-blue-100 hover:shadow-2xl hover:border-blue-300 transition group cursor-pointer flex flex-col items-center text-center">
        <div class="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center text-4xl mb-4 group-hover:scale-110 transition">📘</div>
        <h2 class="text-2xl font-bold text-blue-800 mb-1">صحيح مسلم</h2>
        <span class="text-sm text-blue-400 font-bold bg-blue-50 px-3 py-1 rounded-full mt-2">قريباً</span>
      </NuxtLink>

    </div>
      <!-- Réseaux sociaux -->
    <footer class="mt-16 text-center">
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
    </footer>

  </div>
</template>

<style>
.font-serif { font-family: 'Amiri', serif; }
</style>