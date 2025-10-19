import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getSetting } from '../../utils/settingsLoader';
import '../../styles/Sidebar.css';
import {
  LayoutDashboard,
  Ticket,
  Users,
  Settings,
  TrendingUp,
  Briefcase,
  FileText,
  Bell,
  HelpCircle,
  Shield
} from 'lucide-react';

const Sidebar = ({ isOpen, toggleSidebar }) => {
  const { user } = useAuth();
  
  // Get settings
  const systemName = getSetting('system_name', 'Nexus Support');
  const systemTitle = getSetting('system_title', 'IT Service Desk');

  const navigationItems = [
    {
      label: 'Dashboard',
      icon: LayoutDashboard,
      path: '/dashboard',
      show: true
    },
    {
      label: 'Tickets',
      icon: Ticket,
      path: '/tickets',
      show: user?.permissions?.can_create_tickets
    },
    {
      label: 'My Tickets',
      icon: FileText,
      path: '/my-tickets',
      show: true
    },
    {
      label: 'Notifications',
      icon: Bell,
      path: '/notifications',
      show: true
    },
    {
      label: 'Users',
      icon: Users,
      path: '/users',
      show: user?.permissions?.can_manage_users
    },
    {
      label: 'Departments',
      icon: Briefcase,
      path: '/departments',
      show: user?.permissions?.can_manage_departments || user?.role_name === 'Admin'
    },
    {
      label: 'Roles',
      icon: Shield,
      path: '/roles',
      show: user?.permissions?.can_manage_roles || user?.role_name === 'Admin'
    },
    {
      label: 'Analytics',
      icon: TrendingUp,
      path: '/analytics',
      show: user?.permissions?.can_view_analytics
    },
    {
      label: 'Settings',
      icon: Settings,
      path: '/settings',
      show: user?.permissions?.can_manage_system
    }
  ];

  const visibleMenuItems = navigationItems.filter(item => item.show);

  return (
    <>
      {isOpen && (
        <div 
          className="sidebar-overlay" 
          onClick={toggleSidebar}
        />
      )}

      <aside className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="logo-icon-sidebar">
              <Shield size={24} />
            </div>
            <div className="logo-text">
              <h2>{systemName}</h2>
              <p>{systemTitle}</p>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">
            <p className="nav-section-title">Main Menu</p>
            {visibleMenuItems.slice(0, 4).map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => 
                    `nav-link ${isActive ? 'active' : ''}`
                  }
                  onClick={toggleSidebar}
                >
                  <Icon size={20} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>

          {visibleMenuItems.slice(4, 7).length > 0 && (
            <div className="nav-section">
              <p className="nav-section-title">Management</p>
              {visibleMenuItems.slice(4, 7).map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) => 
                      `nav-link ${isActive ? 'active' : ''}`
                    }
                    onClick={toggleSidebar}
                  >
                    <Icon size={20} />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          )}

          {visibleMenuItems.slice(7).length > 0 && (
            <div className="nav-section">
              <p className="nav-section-title">System</p>
              {visibleMenuItems.slice(7).map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) => 
                      `nav-link ${isActive ? 'active' : ''}`
                    }
                    onClick={toggleSidebar}
                  >
                    <Icon size={20} />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          )}

          <div className="nav-section">
            <p className="nav-section-title">Support</p>
            <NavLink
              to="/help"
              className={({ isActive }) => 
                `nav-link ${isActive ? 'active' : ''}`
              }
              onClick={toggleSidebar}
            >
              <HelpCircle size={20} />
              <span>Help Center</span>
            </NavLink>
          </div>
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;