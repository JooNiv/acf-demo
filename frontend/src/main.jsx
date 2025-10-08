import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CButton } from '@cscfi/csc-ui-react'
import App from './App.jsx'

// metadata
document.title = 'Quantum Bell State Simulator'


createRoot(document.getElementById('root')).render(
  //<StrictMode>
  <div>
    <div className='flex flex-row border-b-4 border-[#006778ff] justify-between items-center'>
      <h1 className="m-6 text-4xl font-bold">Quantum Bell State Simulator</h1>
      <CButton
        type="button"
        className='flex items-center m-6'
        onClick={() => window.open('https://fiqci.fi/status', '_blank')}
      >
        Calibration Data
      </CButton>
    </div>
    <App />
  </div>
  //</StrictMode>,
)
