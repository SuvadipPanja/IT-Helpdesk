/**
 * ============================================
 * SIDEBAR NAVIGATION COMPONENT
 * ============================================
 * Production-Ready Enterprise Sidebar
 * 
 * FEATURES:
 * - Role-based navigation items
 * - Memoized for performance optimization
 * - Fully accessible (ARIA labels, keyboard nav)
 * - Error boundary handling
 * - Responsive overlay for mobile
 * - Dynamic settings loading with fallbacks
 * - PropTypes validation
 * - Clean separation of concerns
 * 
 * Developer: Suvadip Panja
 * Company: Digitide
 * Version: 2.0.0
 * Updated: February 2026
 * FILE: frontend/src/components/layout/Sidebar.jsx
 * ============================================
 */

import { memo, useMemo, useCallback, useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useAuth } from '../../context/AuthContext';
import { getSetting } from '../../utils/settingsLoader';
import '../../styles/Sidebar.css';

// ============================================
// ICON IMPORTS - Lucide React
// ============================================
import {
  LayoutDashboard,
  Ticket,
  Users,
  Settings,
  TrendingUp,
  Briefcase,
  Bell,
  HelpCircle,
  Shield,
  ShieldCheck,
  AlertCircle,
  Inbox,
  Activity,
  AlertTriangle,
  MessageSquare,
  ListChecks,
  BookOpen,
  UsersRound,
  FolderKanban,
  ClipboardList,
  Archive,
  FileSpreadsheet,
  Megaphone,
  Send
} from 'lucide-react';

// ============================================
// NAVIGATION CONFIGURATION
// Centralized config for easy maintenance
// ============================================
const NAVIGATION_CONFIG = {
  mainMenu: {
    title: 'Main Menu',
    items: ['dashboard', 'tickets', 'ticket-bucket', 'team-bucket', 'my-queue', 'my-approvals', 'pending-closures', 'notifications', 'security']
  },
  management: {
    title: 'Management',
    items: ['users', 'teams', 'departments', 'roles']
  },
  system: {
    title: 'System',
    items: ['analytics', 'reports']
  },
  outage: {
    title: 'Outage',
    items: ['outage-wall', 'outage-publish', 'outage-templates']
  },
  settings: {
    title: 'Settings',
    items: ['settings', 'job-monitor', 'incidents', 'snippets', 'knowledge-base']
  },
  support: {
    title: 'Support',
    items: ['help']
  }
};

// ============================================
// DEFAULT SETTINGS (Fallbacks)
// ============================================
const DEFAULT_SETTINGS = {
  systemName: 'Nexus Support',
  systemTitle: 'IT Help-Desk Service.'
};

// ============================================
// NAVIGATION ITEMS GENERATOR
// Returns navigation items based on user permissions
// ============================================
const getNavigationItems = (user, hasLicensedFeature) => {
  // Safely check permissions with fallbacks
  const hasPermission = (permission) => {
    try {
      return Boolean(user?.permissions?.[permission]);
    } catch {
      return false;
    }
  };

  const isAdmin = user?.role_name === 'Admin';
  const roleCode = user?.role?.role_code || '';
  const isClosureReviewer = ['ADMIN', 'MANAGER', 'CENTRAL_MGMT'].includes(roleCode);

  // Check if user has any settings tab permission
  const hasAnySettingsPerm = Boolean(
    user?.permissions?.can_manage_system ||
    user?.permissions?.can_manage_settings_general ||
    user?.permissions?.can_manage_settings_email ||
    user?.permissions?.can_manage_settings_tickets ||
    user?.permissions?.can_manage_settings_sla ||
    user?.permissions?.can_manage_settings_security ||
    user?.permissions?.can_manage_settings_bot ||
    user?.permissions?.can_manage_settings_license ||
    user?.permissions?.can_manage_settings_backup
  );

  return [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      path: '/dashboard',
      show: true,
      ariaLabel: 'Go to Dashboard'
    },
    {
      id: 'tickets',
      label: 'Tickets',
      icon: Ticket,
      path: '/tickets',
      show: hasPermission('can_create_tickets'),
      ariaLabel: 'View all tickets'
    },
    {
      id: 'ticket-bucket',
      label: 'Open Bucket',
      icon: Inbox,
      path: '/ticket-bucket',
      show: hasPermission('can_assign_tickets'),
      ariaLabel: 'Browse and pick up unassigned tickets'
    },
    {
      id: 'my-queue',
      label: 'My Queue',
      icon: ListChecks,
      path: '/my-queue',
      show: hasPermission('can_assign_tickets') && !hasPermission('can_manage_users'),
      ariaLabel: 'My active assigned tickets'
    },
    {
      id: 'my-approvals',
      label: 'My Approvals',
      icon: ClipboardList,
      path: '/my-approvals',
      show: true,
      ariaLabel: 'Pending approval requests'
    },
    {
      id: 'pending-closures',
      label: 'Pending Closures',
      icon: Archive,
      path: '/pending-closures',
      show: isClosureReviewer,
      ariaLabel: 'Tickets waiting for closure approval'
    },
    {
      id: 'team-bucket',
      label: 'Team Bucket',
      icon: FolderKanban,
      path: '/team-bucket',
      show: hasPermission('can_assign_tickets'),
      ariaLabel: 'Team-scoped ticket queue'
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: Bell,
      path: '/notifications',
      show: true,
      ariaLabel: 'View notifications'
    },
    {
      id: 'users',
      label: 'Users',
      icon: Users,
      path: '/users',
      show: hasPermission('can_manage_users'),
      ariaLabel: 'Manage users'
    },
    {
      id: 'teams',
      label: 'Teams',
      icon: UsersRound,
      path: '/teams',
      show: hasPermission('can_manage_users') || isAdmin,
      ariaLabel: 'Manage support teams'
    },
    {
      id: 'departments',
      label: 'Departments',
      icon: Briefcase,
      path: '/departments',
      show: hasPermission('can_manage_departments') || isAdmin,
      ariaLabel: 'Manage departments'
    },
    {
      id: 'roles',
      label: 'Roles',
      icon: Shield,
      path: '/roles',
      show: hasPermission('can_manage_roles') || isAdmin,
      ariaLabel: 'Manage roles'
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: TrendingUp,
      path: '/analytics',
      show: hasPermission('can_view_analytics') && hasLicensedFeature('analytics'),
      ariaLabel: 'View analytics'
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: FileSpreadsheet,
      path: '/reports',
      show: hasPermission('can_view_analytics') && hasLicensedFeature('analytics'),
      ariaLabel: 'Operational reports and exports'
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      path: '/settings',
      show: hasAnySettingsPerm,
      ariaLabel: 'System settings'
    },
    {
      id: 'security',
      label: 'Security',
      icon: ShieldCheck,
      path: '/security',
      show: true,
      ariaLabel: 'Two-factor authentication settings'
    },
    {
      id: 'help',
      label: 'Help Center',
      icon: HelpCircle,
      path: '/help',
      show: true,
      ariaLabel: 'Get help'
    },
    {
      id: 'job-monitor',
      label: 'Job Monitor',
      icon: Activity,
      path: '/job-monitor',
      show: hasPermission('can_view_job_monitor'),
      ariaLabel: 'Background job monitor'
    },
    {
      id: 'incidents',
      label: 'Incidents',
      icon: AlertTriangle,
      path: '/incidents',
      show: hasPermission('can_manage_incidents'),
      ariaLabel: 'Service incident management'
    },
    {
      id: 'snippets',
      label: 'Response Snippets',
      icon: MessageSquare,
      path: '/snippets',
      show: hasPermission('can_manage_snippets'),
      ariaLabel: 'Manage response snippet templates'
    },
    {
      id: 'knowledge-base',
      label: 'Knowledge Base',
      icon: BookOpen,
      path: '/knowledge-base',
      show: hasPermission('can_manage_kb'),
      ariaLabel: 'Manage knowledge base articles and FAQs'
    },
    {
      id: 'outage-wall',
      label: 'Service Status',
      icon: AlertTriangle,
      path: '/outage-wall',
      show: true,
      ariaLabel: 'View active outage notifications'
    },
    {
      id: 'outage-publish',
      label: 'Outage Publisher',
      icon: Send,
      path: '/outage-publish',
      show: hasPermission('can_manage_system') || isAdmin || ['ADMIN', 'CENTRAL_MGMT'].includes(roleCode),
      ariaLabel: 'Create and publish outage notifications'
    },
    {
      id: 'outage-templates',
      label: 'Outage Templates',
      icon: Megaphone,
      path: '/outage-templates',
      show: hasPermission('can_manage_system') || isAdmin,
      ariaLabel: 'Manage outage notification templates'
    }
  ];
};

// ============================================
// NAV ITEM COMPONENT (Memoized)
// Individual navigation link with accessibility
// ============================================
const NavItem = memo(({ item, onClick, isActive }) => {
  const Icon = item.icon;

  // Handle click with keyboard support
  const handleClick = useCallback((e) => {
    if (onClick) {
      onClick(e);
    }
  }, [onClick]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick(e);
    }
  }, [handleClick]);

  return (
    <NavLink
      to={item.path}
      className={({ isActive: linkActive }) =>
        `nav-link ${linkActive || isActive ? 'active' : ''}`
      }
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={item.ariaLabel}
      aria-current={isActive ? 'page' : undefined}
      role="menuitem"
      tabIndex={0}
      data-nav-id={item.id}
    >
      <span className="nav-link-icon" aria-hidden="true">
        <Icon size={20} aria-hidden="true" />
      </span>
      <span className="nav-link-label">{item.label}</span>
    </NavLink>
  );
});

NavItem.displayName = 'NavItem';

NavItem.propTypes = {
  item: PropTypes.shape({
    id: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    icon: PropTypes.elementType.isRequired,
    path: PropTypes.string.isRequired,
    ariaLabel: PropTypes.string
  }).isRequired,
  onClick: PropTypes.func,
  isActive: PropTypes.bool
};

NavItem.defaultProps = {
  onClick: null,
  isActive: false
};

// ============================================
// NAV SECTION COMPONENT (Memoized)
// Groups navigation items with title
// ============================================
const NavSection = memo(({ title, items, onItemClick, currentPath }) => {
  // Don't render empty sections
  if (!items || items.length === 0) {
    return null;
  }

  const sectionId = `nav-section-${title.toLowerCase().replace(/\s+/g, '-')}`;

  // Only render if there are items to display
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <div
      className="nav-section"
      role="menu"
      aria-labelledby={sectionId}
    >
      <p
        className="nav-section-title"
        id={sectionId}
        aria-hidden="true"
      >
        {title}
      </p>
      {items.map((item) => (
        <NavItem
          key={item.id}
          item={item}
          onClick={onItemClick}
          isActive={currentPath === item.path}
        />
      ))}
    </div>
  );
});

NavSection.displayName = 'NavSection';

NavSection.propTypes = {
  title: PropTypes.string.isRequired,
  items: PropTypes.arrayOf(PropTypes.object).isRequired,
  onItemClick: PropTypes.func,
  currentPath: PropTypes.string
};

// ============================================
// SIDEBAR HEADER COMPONENT (Memoized)
// Displays system branding
// ============================================
const SidebarHeader = memo(({
  systemName = DEFAULT_SETTINGS.systemName,
  systemTitle = DEFAULT_SETTINGS.systemTitle,
  logoUrl = '/logo.svg'
}) => (
  <div className="sidebar-header">
    <div className="sidebar-logo">
      <div className="logo-icon-sidebar" aria-hidden="true">
        <img src={logoUrl} alt={systemName} width="28" height="28" onError={(e) => { e.target.src = '/logo.svg'; }} />
      </div>
      <div className="logo-text">
        <h2>{systemName}</h2>
        <p>{systemTitle}</p>
      </div>
    </div>
  </div>
));

SidebarHeader.displayName = 'SidebarHeader';

SidebarHeader.propTypes = {
  systemName: PropTypes.string,
  systemTitle: PropTypes.string,
  logoUrl: PropTypes.string
};

// ============================================
// ERROR FALLBACK COMPONENT
// Shown when navigation fails to load
// ============================================
const SidebarError = memo(({ onRetry }) => (
  <div className="sidebar-error" role="alert" aria-live="polite">
    <AlertCircle size={24} aria-hidden="true" />
    <p>Navigation unavailable</p>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="btn-retry"
        aria-label="Retry loading navigation"
      >
        Retry
      </button>
    )}
  </div>
));

SidebarError.displayName = 'SidebarError';

SidebarError.defaultProps = {
  onRetry: null
};

// ============================================
// MAIN SIDEBAR COMPONENT
// ============================================
const Sidebar = ({ isOpen = false, toggleSidebar = () => { } }) => {
  // ----------------------------------------
  // HOOKS
  // ----------------------------------------
  const { user, hasLicensedFeature } = useAuth();
  const location = useLocation();

  // Track settings version to re-compute memoized values on settings change
  const [, setSettingsVersion] = useState(0);

  useEffect(() => {
    const handler = () => setSettingsVersion(v => v + 1);
    window.addEventListener('settings-updated', handler);
    return () => window.removeEventListener('settings-updated', handler);
  }, []);

  // ----------------------------------------
  // SYSTEM SETTINGS (Fallbacks)
  // ----------------------------------------
  const systemName = (() => {
    try {
      return getSetting('system_name', DEFAULT_SETTINGS.systemName) || DEFAULT_SETTINGS.systemName;
    } catch {
      return DEFAULT_SETTINGS.systemName;
    }
  })();

  const systemTitle = (() => {
    try {
      return getSetting('system_title', DEFAULT_SETTINGS.systemTitle) || DEFAULT_SETTINGS.systemTitle;
    } catch {
      return DEFAULT_SETTINGS.systemTitle;
    }
  })();

  const logoUrl = (() => {
    try {
      const raw = getSetting('logo_url', '/logo.svg');
      if (raw && raw.startsWith('/uploads')) {
        const base = import.meta.env.VITE_API_BASE_URL?.replace('/api/v1', '') || '';
        return `${base}${raw}`;
      }
      return raw || '/logo.svg';
    } catch {
      return '/logo.svg';
    }
  })();

  // ----------------------------------------
  // NAVIGATION ITEMS (Memoized)
  // ----------------------------------------
  const navigationItems = useMemo(() => {
    try {
      return getNavigationItems(user, hasLicensedFeature);
    } catch (error) {
      // Missing icon import or bad nav config would throw — log so we fix root cause, not silent empty nav
      if (process.env.NODE_ENV === 'development') console.error('[Sidebar] getNavigationItems failed:', error);
      return [];
    }
  }, [user, hasLicensedFeature]);

  // ----------------------------------------
  // FILTERED ITEMS BY SECTION (Memoized)
  // ----------------------------------------
  const sectionItems = useMemo(() => {
    const visibleItems = navigationItems.filter(item => item.show);

    return {
      mainMenu: visibleItems.filter(item =>
        NAVIGATION_CONFIG.mainMenu.items.includes(item.id)
      ),
      management: visibleItems.filter(item =>
        NAVIGATION_CONFIG.management.items.includes(item.id)
      ),
      system: visibleItems.filter(item =>
        NAVIGATION_CONFIG.system.items.includes(item.id)
      ),
      settings: visibleItems.filter(item =>
        NAVIGATION_CONFIG.settings.items.includes(item.id)
      ),
      outage: visibleItems.filter(item =>
        NAVIGATION_CONFIG.outage.items.includes(item.id)
      ),
      support: visibleItems.filter(item =>
        NAVIGATION_CONFIG.support.items.includes(item.id)
      )
    };
  }, [navigationItems]);

  // ----------------------------------------
  // HANDLERS (Memoized)
  // ----------------------------------------
  const handleClose = useCallback(() => {
    if (isOpen && typeof toggleSidebar === 'function') {
      toggleSidebar();
    }
  }, [isOpen, toggleSidebar]);

  const handleKeyDown = useCallback((event) => {
    // Close sidebar on Escape key
    if (event.key === 'Escape' && isOpen) {
      handleClose();
    }
  }, [isOpen, handleClose]);

  const handleOverlayClick = useCallback((event) => {
    // Close only when clicking the overlay itself
    if (event.target === event.currentTarget) {
      handleClose();
    }
  }, [handleClose]);

  const handleRetry = useCallback(() => {
    window.location.reload();
  }, []);

  // ----------------------------------------
  // CURRENT PATH (Memoized)
  // ----------------------------------------
  const currentPath = useMemo(() => location.pathname, [location.pathname]);

  // ----------------------------------------
  // ERROR STATE RENDER
  // ----------------------------------------
  if (!navigationItems || navigationItems.length === 0) {
    return (
      <div className={`sidebar-shell ${isOpen ? 'sidebar-shell-open' : ''}`}>
        <aside
          id="app-sidebar"
          className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}
          role="navigation"
          aria-label="Main navigation"
        >
          <SidebarHeader
            systemName={systemName}
            systemTitle={systemTitle}
            logoUrl={logoUrl}
          />
          <SidebarError onRetry={handleRetry} />
        </aside>
      </div>
    );
  }

  // ----------------------------------------
  // MAIN RENDER
  // ----------------------------------------
  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="sidebar-overlay"
          onClick={handleOverlayClick}
          onKeyDown={handleKeyDown}
          role="presentation"
          aria-hidden="true"
          data-testid="sidebar-overlay"
        />
      )}

      {/* Sidebar Container */}
      <div className={`sidebar-shell ${isOpen ? 'sidebar-shell-open' : ''}`}>
        <aside
          id="app-sidebar"
          className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}
          role="navigation"
          aria-label="Main navigation"
          data-testid="sidebar"
          onKeyDown={handleKeyDown}
        >
          {/* Header with Branding */}
          <SidebarHeader
            systemName={systemName}
            systemTitle={systemTitle}
            logoUrl={logoUrl}
          />

          {/* Navigation Menu */}
          <nav
            className="sidebar-nav"
            role="menubar"
            aria-label="Primary navigation"
          >
            {/* Main Menu: Dashboard, Tickets, Notifications */}
            <NavSection
              title={NAVIGATION_CONFIG.mainMenu.title}
              items={sectionItems.mainMenu}
              onItemClick={handleClose}
              currentPath={currentPath}
            />

            {/* Management: Users, Departments, Roles */}
            {sectionItems.management.length > 0 && (
              <NavSection
                title={NAVIGATION_CONFIG.management.title}
                items={sectionItems.management}
                onItemClick={handleClose}
                currentPath={currentPath}
              />
            )}

            {/* System: Analytics */}
            {sectionItems.system.length > 0 && (
              <NavSection
                title={NAVIGATION_CONFIG.system.title}
                items={sectionItems.system}
                onItemClick={handleClose}
                currentPath={currentPath}
              />
            )}

            {/* Settings: Settings, Job Monitor, Incidents, Snippets */}
            {sectionItems.settings.length > 0 && (
              <NavSection
                title={NAVIGATION_CONFIG.settings.title}
                items={sectionItems.settings}
                onItemClick={handleClose}
                currentPath={currentPath}
              />
            )}

            {/* Outage: Service Status, Publisher, Templates */}
            {sectionItems.outage.length > 0 && (
              <NavSection
                title={NAVIGATION_CONFIG.outage.title}
                items={sectionItems.outage}
                onItemClick={handleClose}
                currentPath={currentPath}
              />
            )}

            {/* Support: Help Center */}
            <NavSection
              title={NAVIGATION_CONFIG.support.title}
              items={sectionItems.support}
              onItemClick={handleClose}
              currentPath={currentPath}
            />
          </nav>
        </aside>
      </div>
    </>
  );
};

// ============================================
// PROP TYPES VALIDATION
// ============================================
Sidebar.propTypes = {
  /** Controls sidebar visibility on mobile */
  isOpen: PropTypes.bool,
  /** Callback to toggle sidebar open/closed state */
  toggleSidebar: PropTypes.func
};

// ============================================
// DISPLAY NAME (for DevTools)
// ============================================
Sidebar.displayName = 'Sidebar';

// ============================================
// EXPORT (Memoized for Performance)
// ============================================
export default memo(Sidebar);