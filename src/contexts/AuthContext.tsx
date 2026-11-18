import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, UserRole } from '@/types';
import { auth, googleProvider } from '@/lib/firebase';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { dataService } from '@/lib/dataService';
import { toast } from 'sonner';

export const SUPER_ADMIN_EMAIL = 'direccioncondominiossotillo@gmail.com';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isEditor: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        if (!firebaseUser.emailVerified) {
          toast.error("Su correo electrónico debe estar verificado para acceder al sistema.");
          setUser(null);
          await signOut(auth);
          setLoading(false);
          return;
        }

        let profile = await dataService.getUserProfile(firebaseUser.uid);
        
        const isSuperAdminEmail = firebaseUser.emailVerified && firebaseUser.email === SUPER_ADMIN_EMAIL;

        if (!profile) {
          // Check if this is the super admin or default editor
          profile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            role: isSuperAdminEmail ? 'superadmin' : 'editor',
            fullName: firebaseUser.displayName || 'Usuario',
            photoURL: firebaseUser.photoURL || '',
            blocked: false
          };
          await dataService.createUserProfile(profile);
        } else if (isSuperAdminEmail && profile.role !== 'superadmin') {
          // Auto-promote system super admin if needed
          profile.role = 'superadmin';
          await dataService.updateUserRole(profile.uid, 'superadmin');
        }
        
        if (profile.blocked) {
          toast.error("Tu usuario ha sido bloqueado por el administrador.", {
            id: "user-blocked-toast"
          });
          setUser(null);
          await signOut(auth);
        } else {
          setUser(profile);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login Error:", error);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  const isSuperAdmin = user?.role === 'superadmin' || user?.email === SUPER_ADMIN_EMAIL;
  const isAdmin = isSuperAdmin || user?.role === 'admin';
  const isEditor = isAdmin || user?.role === 'editor';

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isSuperAdmin, isAdmin, isEditor }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
