import { ReactNode } from 'react';
import AppSidebar from './AppSidebar';
import MobileBottomNav from './MobileBottomNav';

const AppLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:block">
        <AppSidebar />
      </div>
      <main className="flex-1 overflow-auto pb-20 lg:pb-0">
        <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
          {children}
        </div>
      </main>
      <MobileBottomNav />
    </div>
  );
};

export default AppLayout;
