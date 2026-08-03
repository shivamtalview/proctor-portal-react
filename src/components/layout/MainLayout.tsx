import { useQueryClient } from '@tanstack/react-query';
import { Outlet } from 'react-router';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';

export default function MainLayout() {
  const queryClient = useQueryClient();
  useRealtimeSync(queryClient);

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 ml-60 flex flex-col bg-bg">
        <Topbar />
        <div className="flex-1 p-6 bg-bg">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
