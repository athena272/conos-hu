import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { setupChunkReload } from './utils/chunkReload'
import { Analytics } from '@vercel/analytics/react'

setupChunkReload()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Analytics />
  </StrictMode>,
)
