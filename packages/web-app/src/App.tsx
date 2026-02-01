import type React from 'react'
import { Provider } from 'react-redux'
import { store } from './store'
import { CouchGame } from './CouchGame'

export function App(): React.JSX.Element {
  return (
    <Provider store={store}>
      <CouchGame />
    </Provider>
  )
}
