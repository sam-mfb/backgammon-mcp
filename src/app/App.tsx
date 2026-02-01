import { Provider } from 'react-redux'
import { store } from './store'
import { Board } from '@/viewer'

export function App() {
  return (
    <Provider store={store}>
      <div className="app">
        <h1>Backgammon MCP</h1>
        <Board />
      </div>
    </Provider>
  )
}
