import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export function useAdminAuth() {
  const [session, setSession] = useState(undefined); // undefined = todavía cargando

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return {
    session,
    isLoading: session === undefined,
    isAuthenticated: !!session,
    signIn,
    signOut,
  };
}
