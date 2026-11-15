import { BrowserRouter } from 'react-router'
import { ToastProvider } from '../ui/Toast'
import { Boot } from './Boot'
import { ErrorBoundary } from './ErrorBoundary'
import { LaunchGate } from './LaunchGate'
import { StorageFailureGate } from './StorageFailureGate'
import { AppRoutes } from './routes'

function App() {
  return (
    <ToastProvider>
      <StorageFailureGate />
      <ErrorBoundary>
        <Boot>
          {/* BASE_URL is "/" in dev and the deployment path in builds. */}
          <BrowserRouter basename={import.meta.env.BASE_URL}>
            <LaunchGate>
              <AppRoutes />
            </LaunchGate>
          </BrowserRouter>
        </Boot>
      </ErrorBoundary>
    </ToastProvider>
  )
}

export default App
