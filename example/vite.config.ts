import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import swiftly from "@swiftly/vite-plugin"

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    swiftly(),
    react()
  ],
});
