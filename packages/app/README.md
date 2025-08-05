Swiftly
=======

Swiftly is another tiny web framework to make building single-page web applications
(SPAs) really fast.

Swiftly works similar to NextJS in that a directory structure determines the
routes of your app.

## Features

 - NextJS inspired directory structure for routing pages
 - Fast and easy authorization support using `useIsAuthorized`
 - Inspection of generated routes for generating UI elements

## Quick Start

### 1. Integrate with your web bundler

You must integrate Swiftly with your web bundler of choice. Currently we only
support [Vite][vite].

[vite]: https://github.com/samvv/swiftly/tree/main/packages/vite-plugin

### 2. Configure your application

**src/main.tsx**
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// This lazily imports all pages
import App from "@swiftly/app/app"

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

### 3. Add a homepage

**src/pages/index.tsx**
```tsx
export default function Home() {
    return (
        <>
            <h1>Hello, world!</h1>
            <p>
                This is my first app in Swiftly!
            </p>
        </>
    );
}
```

