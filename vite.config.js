import { defineConfig } from 'vite'

export default defineConfig({
  base: '/Windchime/',
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        india: 'india.html',
        cambodia: 'cambodia.html',
      },
    },
  },
})
