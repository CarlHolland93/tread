import { createBrowserRouter, Navigate } from 'react-router-dom'
import { Scan } from '@/app/screens/Scan'
import { Processing } from '@/app/screens/Processing'
import { ScanResult } from '@/app/screens/ScanResult'

export const router = createBrowserRouter([
  { path: '/', element: <Scan /> },
  { path: '/processing', element: <Processing /> },
  { path: '/result', element: <ScanResult /> },
  { path: '*', element: <Navigate to="/" replace /> },
])
