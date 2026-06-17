import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { setupChunkReload } from './utils/chunkReload'

setupChunkReload()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
