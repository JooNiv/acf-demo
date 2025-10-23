import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { CButton, CModal, CCard, CCardContent, CCardActions, CCardTitle } from '@cscfi/csc-ui-react'
import {QRCodeSVG} from 'qrcode.react'
import App from './App.jsx'

// metadata
document.title = 'Quantum Entanglement Game'

export const useWindowSize = () => {
    const [width, setWidth] = useState(
        typeof window !== 'undefined' ? window.innerWidth : 0
    );

    useEffect(() => {
        const onResize = () => setWidth(window.innerWidth);

        window.addEventListener('resize', onResize);
        // In case the window was resized before the listener attached
        onResize();

        return () => {
            window.removeEventListener('resize', onResize);
        };
    }, []);

    return { width };
}

function MainApp() {
  const [showQRModal, setShowQRModal] = useState(false)
  const currentUrl = window.location.href

  const { width } = useWindowSize();
  let size;

  if (width >= 2600) size = 'large';
  else if (width >= 768) size = 'medium';
  else size = 'small';

  const modalWidths = { small: '90vw', medium: '1400px', large: '50vw' }


  return (
    <div>
      <div className='flex flex-row border-b-4 border-[#006778ff] justify-between items-center'>
        <div className='flex flex-row items-center'>
          <h1 className="m-6 text-4xl font-bold">Quantum Entanglement Game</h1>
          <CButton
            type="button"
            className='flex items-center m-6'
            onClick={() => setShowQRModal(true)}
          >
            QR Code
          </CButton>
        </div>
        <CButton
          type="button"
          className='flex items-center m-6'
          onClick={() => window.open('https://fiqci.fi/status', '_blank')}
        >
          Calibration Data
        </CButton>
      </div>
      <App />
      
      <CModal
        value={showQRModal}
        width={modalWidths[size]}
        dismissable
        onChangeValue={e => setShowQRModal(e.detail)}

      >
        <CCard>
          <CCardContent>
            <CCardTitle className='font-bold'>QR Code</CCardTitle>
            <div className="flex justify-center mb-4">
              <QRCodeSVG
                className="min-h-[50vh] w-auto"
                value={currentUrl} 
              />
            </div>
            <p className="text-sm text-gray-600 text-center break-all">
              {currentUrl}
            </p>
          </CCardContent>
          <CCardActions>
            <CButton
              type="button"
              onClick={() => setShowQRModal(false)}
              className="ml-auto"
            >
              Close
            </CButton>
          </CCardActions>
        </CCard>
      </CModal>
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  //<StrictMode>
  <MainApp />
  //</StrictMode>,
)
