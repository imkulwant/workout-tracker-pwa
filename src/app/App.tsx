import { BrowserRouter } from 'react-router'
import { ToastProvider } from '../ui/Toast'
import { Boot } from './Boot'
import { AppRoutes } from './routes'

function App() {
  return (
    <ToastProvider>
      <Boot>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </Boot>
    </ToastProvider>
  )
}

export default App
