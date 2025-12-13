/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // <--- C'EST CETTE LIGNE QUI CORRIGE LE PROBLÈME
  content: [
    "./components/**/*.{js,vue,ts}",
    "./layouts/**/*.vue",
    "./pages/**/*.vue",
    "./plugins/**/*.{js,ts}",
    "./app.vue",
    "./error.vue",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}