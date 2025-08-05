# Vite Plugin for Swiftly

This is the official Vite plugin for the Swiftly framework.

## Quick Start

Here's an example of a working configuration for Vite and Swiftly:

**vite.config.ts**
```ts
import { defineConfig } from 'vite'
import swiftly from '@swiftly/vite-plugin'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    swiftly(),
    react()
  ],
})
```
