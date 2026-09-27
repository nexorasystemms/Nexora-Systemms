import React, { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import MissingConfigScreen from '@/components/MissingConfigScreen'
import type { StaffRole } from '@/types/database'

interface AuthUser extends User {
  role?: StaffRole
  full_name?: string
  tenant_id?: string
  applicant_id?: string
}

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
  isStaff: boolean
  isBorrower: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const configured = isSupabaseConfigured()
  const supabase = configured ? createClient() : null

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadUserProfile(session.user)
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        loadUserProfile(session.user)
      } else {
        setUser(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  async function loadUserProfile(authUser: User) {
    if (!supabase) return
    try {
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (profile) {
        setUser({
          ...authUser,
          role: profile.role as StaffRole | undefined,
          full_name: profile.full_name ?? undefined,
          tenant_id: profile.tenant_id ?? undefined,
          applicant_id: profile.applicant_id ?? undefined
        })
      } else {
        setUser(authUser as AuthUser)
      }
    } catch (error) {
      console.error('Error loading user profile:', error)
      setUser(authUser as AuthUser)
    } finally {
      setLoading(false)
    }
  }

  const signIn = async (email: string, password: string) => {
    if (!supabase) {
      return { error: 'Supabase is not configured' }
    }
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        return { error: error.message }
      }
      return {}
    } catch (error) {
      return { error: 'An unexpected error occurred' }
    }
  }

  const signOut = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
  }

  const isStaff = user?.role && ['super_admin', 'admin', 'intake', 'officer', 'approver', 'finance'].includes(user.role)
  const isBorrower = user?.role === 'borrower'

  const value = {
    user,
    loading,
    signIn,
    signOut,
    isStaff: !!isStaff,
    isBorrower: !!isBorrower
  }

  if (!configured) {
    return <MissingConfigScreen />
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}