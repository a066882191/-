import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';

export function BottomNav() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const isManager = user?.role === 'manager';

  const tabs = [
    { path: '/dashboard', label: t('dashboard'), icon: 'ri-dashboard-line', iconActive: 'ri-dashboard-fill' },
    { path: '/shift', label: '當月班表', icon: 'ri-table-line', iconActive: 'ri-table-fill' },
    { path: '/schedule', label: t('schedule'), icon: 'ri-calendar-line', iconActive: 'ri-calendar-fill' },
    { path: '/leave/apply', label: t('leave_apply'), icon: 'ri-add-circle-line', iconActive: 'ri-add-circle-fill' },
    { path: '/leave/records', label: t('leave_records'), icon: 'ri-file-list-line', iconActive: 'ri-file-list-fill' },
    ...(isManager ? [{ path: '/admin/approval', label: t('approval'), icon: 'ri-shield-check-line', iconActive: 'ri-shield-check-fill' }] : []),
    { path: '/profile', label: t('profile'), icon: 'ri-user-line', iconActive: 'ri-user-fill' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-100 z-50">
      <div className="max-w-lg mx-auto flex items-center justify-around px-1">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`flex flex-col items-center py-2 px-1 min-w-0 flex-1 transition-colors ${
                isActive ? 'text-emerald-600' : 'text-stone-400'
              }`}
            >
              <div className="w-6 h-6 flex items-center justify-center">
                <i className={`${isActive ? tab.iconActive : tab.icon} text-lg`} />
              </div>
              <span className="text-[10px] mt-0.5 truncate w-full text-center whitespace-nowrap">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}