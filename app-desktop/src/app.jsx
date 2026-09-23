import { useState } from 'react';

import AppLayout from './layouts/AppLayout';
import Pedidos from './pages/pedidos';
import ScannerQr from './pages/scanner-qr';
import Dashboard from './pages/dashboard';

function App() {
  const [currentPage, setCurrentPage] = useState('pedidos');

  const renderPage = () => {
    switch (currentPage) {
      case 'pedidos':
        return <Pedidos />;

      case 'scanner-qr':
        return <ScannerQr />;

      case 'dashboard':
        return <Dashboard />;

      default:
        return <Pedidos />;
    }
  };

  return (
    <AppLayout currentPage={currentPage} onNavigate={setCurrentPage}>
      {renderPage()}
    </AppLayout>
  );
}

export default App;