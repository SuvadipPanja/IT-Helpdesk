// ============================================
// LAYOUT COMPONENT - UPDATED
// Added Password Expiry Banner
// Developer: Suvadip Panja
// Date: November 09, 2025
// FILE: components/layout/Layout.jsx
// ============================================

import { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import PasswordExpiryBanner from '../passwordExpiry/PasswordExpiryBanner';
import AIAssistant from '../helpdesk/AIAssistant';
import IncidentBanner from '../common/IncidentBanner';

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen((current) => !current);
  };

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 769px)');

    const handleViewportChange = (event) => {
      if (event.matches) {
        setSidebarOpen(false);
      }
    };

    if (mediaQuery.matches) {
      setSidebarOpen(false);
    }

    mediaQuery.addEventListener('change', handleViewportChange);

    return () => {
      mediaQuery.removeEventListener('change', handleViewportChange);
    };
  }, []);

  return (
    <div className="dashboard-container">
      <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />
      <div className="main-content">
        <Header toggleSidebar={toggleSidebar} sidebarOpen={sidebarOpen} />
        
        {/* Password Expiry Warning Banner */}
        <PasswordExpiryBanner />

        {/* Known Incident / Service Status Banner */}
        <IncidentBanner />
        
        {/* Main content area */}
        <main className="dashboard-content">
          {children}
        </main>

        <AIAssistant />
      </div>
    </div>
  );
};

export default Layout;