import { ReactNode } from 'react';
import AppSidebar from './AppSidebar';
import MobileBottomNav from './MobileBottomNav';

const AppLayout = ({ children, noPadding }: { children: ReactNode; noPadding?: boolean }) => {
  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden md:block">
        <AppSidebar />
      </div>
      <main className={`flex-1 overflow-hidden ${noPadding ? 'pb-16 md:pb-0' : 'pb-20 md:pb-0'}`}>
        <div className={noPadding ? 'h-full' : 'p-4 md:p-6 max-w-[1400px] mx-auto'}>
          {children}
        </div>
      </main>
      <MobileBottomNav />
    </div>
  );
};

export default AppLayout;
