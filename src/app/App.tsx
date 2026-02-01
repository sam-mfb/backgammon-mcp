import { Provider } from 'react-redux'
import { store } from './store'
import { DemoApp } from './DemoApp'

export function App() {
  return (
    <Provider store={store}>
      <DemoApp />
    </Provider>
  )
}
