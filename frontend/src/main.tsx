import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { setupChunkReload } from './utils/chunkReload'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'

setupChunkReload()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Analytics />
    <SpeedInsights />
  </StrictMode>,
)
