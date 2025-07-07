'use client';

import ChatInterface from '@/components/ChatInterface';
import { WalletProvider } from '@/contexts/WalletContext';

export default function Home() {
  return (
    <WalletProvider>
      <main className="h-screen w-screen overflow-hidden">
        <ChatInterface />
      </main>
    </WalletProvider>
  );
}
