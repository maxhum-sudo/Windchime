import { defineConfig } from 'vite'

export default defineConfig({
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
