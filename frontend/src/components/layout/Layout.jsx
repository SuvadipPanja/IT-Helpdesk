// ============================================
// LAYOUT COMPONENT - COMPLETE VERSION
// Main layout with sidebar, header, and announcement banner
// Developer: Suvadip Panja
// ============================================

import { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import AnnouncementBanner from './AnnouncementBanner';

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  console.log('📐 Layout rendered');

  return (
    <div className="dashboard-container">
      <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />
      <div className="main-content">
        <Header toggleSidebar={toggleSidebar} />
        
        {/* ============================================
            GLOBAL ANNOUNCEMENT BANNER
            Shows between header and main content
            ============================================ */}
        <AnnouncementBanner />
        
        <main className="dashboard-content">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;