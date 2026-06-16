'use client';

import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import LoginView from '@/components/auth/LoginView';
import OnboardingView from '@/components/auth/OnboardingView';
import AppShell from '@/components/layout/AppShell';
import Footer from '@/components/ui/Footer';
import WeightPrompt from '@/components/weight/WeightPrompt';

export default function AppRoot() {
  const { user, ready } = useAuth();

  let content: React.ReactNode;
  let inApp = false;
  if (!ready) {
    content = (
      <div className="min-h-screen flex items-center justify-center bg-app">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  } else if (!user) {
    content = <LoginView />;
  } else if (!user.hasProfile) {
    content = <OnboardingView />;
  } else {
    content = <AppShell />;
    inApp = true;
  }

  return (
    <>
      {content}
      {inApp && <WeightPrompt />}
      <Footer />
    </>
  );
}
