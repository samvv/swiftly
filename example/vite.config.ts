import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { turboweb } from "@samvv/turboweb/lib/plugin"

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    turboweb(),
    react()
  ],
});
