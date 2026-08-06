import { ReactNode } from 'react';

interface Tab {
  id: string | number;
  label: ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string | number;
  onChange: (id: string | number) => void;
  variant?: 'default' | 'reserved';
  className?: string;
}

const styles = {
  default: {
    button: 'px-4 py-2 text-sm font-medium transition-colors',
    active: 'text-accent border-b-2 border-accent',
    inactive: 'text-text3 hover:text-text',
  },
  reserved: {
    button: 'px-4 py-2.5 text-[13px] font-semibold border-b-2 transition-colors',
    active: 'border-accent text-accent',
    inactive: 'border-transparent text-text3 hover:text-text2',
  },
};

export default function Tabs({ tabs, activeTab, onChange, variant = 'default', className = '' }: TabsProps) {
  const s = styles[variant];
  return (
    <div className={`flex gap-2 mb-6 border-b border-border ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`${s.button} ${activeTab === tab.id ? s.active : s.inactive}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
