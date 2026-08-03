import { NavLink } from 'react-router';
import { useMemo } from 'react';
import { useAuthStore } from '@/stores/auth';

interface NavItem {
  label: string;
  path: string;
  roles?: ('admin' | 'vendor' | 'coordinator')[];
  badge?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
  roles?: ('admin' | 'vendor' | 'coordinator')[];
}

export default function Sidebar() {
  const { user, logout } = useAuthStore();

  // Navigation structure based on role (matches original HTML)
  const getNavSections = (): NavSection[] => {
    if (user?.role === 'admin') {
      return [
        {
          title: 'Overview',
          items: [
            { label: 'Dashboard', path: '/' },
            { label: 'Admin Workspace', path: '/workspace' },
          ],
        },
        {
          title: 'Pipeline',
          items: [
            { label: 'Interview Selects', path: '/interview-selects' },
            { label: 'In Progress', path: '/onboarding' },
            { label: 'All Proctors', path: '/proctors' },
            { label: 'Offboarded & History', path: '/offboarded' },
          ],
        },
        {
          title: 'Onboarding',
          items: [
            { label: 'Onboard / Bulk Onboard', path: '/add-proctor' },
            { label: 'Incomplete BGV', path: '/incomplete' },
          ],
        },
        {
          title: 'Certification',
          items: [
            { label: 'Proctor Certification', path: '/evaluations' },
            { label: 'Certify Client SOP', path: '/certifications' },
          ],
        },
        {
          title: 'System',
          items: [
            { label: 'Customers', path: '/customers' },
            { label: 'Managed By', path: '/vendors' },
            { label: 'Audit Log', path: '/audit' },
          ],
        },
      ];
    } else if (user?.role === 'coordinator') {
      return [
        {
          title: 'My Workspace',
          items: [
            { label: 'Workspace', path: '/workspace' },
          ],
        },
        {
          title: 'Pipeline',
          items: [
            { label: 'Interview Selects', path: '/interview-selects' },
            { label: 'All Proctors', path: '/my-proctors' },
            { label: 'In Progress', path: '/onboarding' },
          ],
        },
        {
          title: 'Onboarding',
          items: [
            { label: 'Onboard / Bulk Onboard', path: '/add-proctor' },
            { label: 'Incomplete BGV', path: '/incomplete' },
          ],
        },
        {
          title: 'Certification',
          items: [
            { label: 'Certify Client SOP', path: '/certifications' },
          ],
        },
      ];
    } else {
      // vendor role
      return [
        {
          title: 'Overview',
          items: [
            { label: 'My Dashboard', path: '/' },
          ],
        },
        {
          title: 'My Proctors',
          items: [
            { label: 'Interview Selects', path: '/interview-selects' },
            { label: 'All Proctors', path: '/my-proctors' },
            { label: 'In Progress', path: '/onboarding' },
          ],
        },
        {
          title: 'Onboarding',
          items: [
            { label: 'Onboard / Bulk Onboard', path: '/add-proctor' },
            { label: 'Incomplete BGV', path: '/incomplete' },
          ],
        },
        {
          title: 'Form Links',
          items: [
            { label: 'Public Form Links', path: '/form-links' },
          ],
        },
      ];
    }
  };

  const navSections = useMemo(() => getNavSections(), [user?.role, user?.vendor]);

  return (
    <aside className="w-60 bg-gradient-to-b from-[#0f2747] to-[#132e57] border-r border-white/10 fixed top-0 left-0 h-screen flex flex-col z-50 text-white shadow-xl">
      {/* Logo */}
      <div className="p-5 border-b border-white/10">
        <div className="flex flex-col">
          <div className="text-base font-extrabold tracking-tight text-white">
            Talview
          </div>
          <div className="text-[10px] text-white/60 font-medium uppercase tracking-wider">
            Proctor Portal
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav aria-label="Main navigation" className="flex-1 p-2 overflow-y-auto">
        {navSections.map((section, idx) => (
          <div key={idx} className="mb-4">
            <div className="text-[10px] font-semibold text-white/45 uppercase tracking-wider px-3 py-2 mb-1">
              {section.title}
            </div>
            {section.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm font-medium transition-all mb-0.5 ${
                    isActive
                      ? 'bg-white/15 text-white'
                      : 'text-white/75 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <span>{item.label}</span>
                {item.badge && (
                  <span className="ml-auto bg-white/15 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* User Info */}
      <div className="p-3 border-t border-white/10">
        <div className="rounded-lg bg-white/5 border border-white/10 p-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent to-accent5 flex items-center justify-center text-[13px] font-bold text-white flex-shrink-0">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white break-words leading-tight">
                {user?.name || 'User'}
              </div>
              <div className="text-[10px] text-white/60 capitalize">
                {user?.role || 'User'}
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            className="mt-3 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-left text-xs font-semibold text-white/80 hover:bg-white/10 hover:text-white transition-colors"
            title="Sign out"
          >
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
