import React from 'react';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { SupabaseStatusBanner } from '../common/SupabaseStatusBanner';

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col bg-ivory text-charcoal">
      <SupabaseStatusBanner />
      <Navbar />
      <main id="main-content" className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 focus:outline-none">
        {children}
      </main>
      <Footer />
    </div>
  );
};
