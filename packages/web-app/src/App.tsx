import { Provider } from 'react-redux'
import { store } from './store'
import { CouchGame } from './CouchGame'

export function App() {
  return (
    <Provider store={store}>
      <CouchGame />
    </Provider>
  )
}
