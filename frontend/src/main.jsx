import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>

    <div className='border-b-4 border-[#006778ff]'>
      <h1 className="m-6 text-4xl font-bold">Quantum Bell State Simulator</h1>
    </div>
    <App />
  </StrictMode>,
)
