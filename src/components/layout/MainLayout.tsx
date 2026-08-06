import { useQueryClient } from '@tanstack/react-query';
import { Outlet } from 'react-router';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';

export default function MainLayout() {
  const queryClient = useQueryClient();
  useRealtimeSync(queryClient);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-60 min-w-0 flex flex-col">
        <Topbar />
        <div className="flex-1 p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
