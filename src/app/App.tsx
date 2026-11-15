import { BrowserRouter } from 'react-router'
import { ToastProvider } from '../ui/Toast'
import { Boot } from './Boot'
import { AppRoutes } from './routes'

function App() {
  return (
    <ToastProvider>
      <Boot>
        {/* BASE_URL is "/" in dev and the deployment path in builds. */}
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <AppRoutes />
        </BrowserRouter>
      </Boot>
    </ToastProvider>
  )
}

export default App
