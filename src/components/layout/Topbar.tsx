import { useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/proctors': 'All Proctors',
  '/my-proctors': 'My Proctors',
  '/interview-selects': 'Interview Selects',
  '/onboarding': 'In Progress',
  '/active': 'Active Proctors',
  '/offboarded': 'Offboarded & History',
  '/add-proctor': 'Add Proctor',
  '/evaluations': 'Evaluations',
  '/workspace': 'My Workspace',
  '/incomplete': 'Incomplete BGV',
  '/certifications': 'Certifications',
  '/customers': 'Customers',
  '/vendors': 'Managed By',
  '/audit': 'Audit Log',
  '/form-links': 'Form Links',
};

export default function Topbar() {
  const location = useLocation();
  const title = PAGE_TITLES[location.pathname] || 'Proctor Portal';
  const [time, setTime] = useState(() => new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="bg-white border-b border-border px-6 h-14 flex items-center justify-between sticky top-0 z-40 shadow-sm">
      <h1 className="text-base font-bold text-text">{title}</h1>
      <div className="flex items-center gap-3">
        <span className="text-[11px] text-text3">
          {time}
        </span>
      </div>
    </div>
  );
}
