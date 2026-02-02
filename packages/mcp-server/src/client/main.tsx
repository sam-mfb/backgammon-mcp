import { createRoot } from 'react-dom/client'
import { McpAppShim } from './McpAppShim'
import '@backgammon/viewer/BoardView.css'

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(<McpAppShim />)
}
