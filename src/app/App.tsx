import { BrowserRouter } from 'react-router'
import { ToastProvider } from '../ui/Toast'
import { Boot } from './Boot'
import { InstallGate } from './InstallGate'
import { AppRoutes } from './routes'

// The gate is outermost, so in a Safari tab nothing else starts: no database
// is opened and no library is seeded.
function App() {
  return (
    <ToastProvider>
      <InstallGate>
        <Boot>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </Boot>
      </InstallGate>
    </ToastProvider>
  )
}

export default App
