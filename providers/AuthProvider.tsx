import { supabase } from '@/utils/supabase'
import { useRouter } from 'expo-router';
import { createContext, useContext, useEffect, useState} from 'react'


export const AuthContext = createContext({
    user: null,
    signIn: async (email: string, password: string) =>{},
    signUp: async (username: string, email: string, password: string) =>{},
    signOut: async () =>{},
});

export const useAuth = () => useContext(AuthContext)

export const AuthProvider = ({ children }:{children: React.ReactNode}) => {
    const [user, setUser] = useState(null);
    const router = useRouter()

    const getUser = async (id:string) => {
        const { data, error } = await supabase.from("User").select("*").eq("id",id).single();
        if(error) throw error
        setUser(data)
        router.push('/(tabs)')

    }

    const signIn = async (email: string, password: string) => {
        console.log(email, password)
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) console.log(error);

        if (error) throw error;

        getUser(data.user.id)

    };

    const signUp = async (username: string, email: string, password: string) => {
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
          });
          if (error) throw error;
          
          if (!data.user?.id) throw new Error('User ID is undefined');
      
          const { error: userError } = await supabase.from('User').insert({
            id: data.user.id,
            email: email,
            username: username,
          });
          if (userError) console.log(userError);
          if(userError) throw userError;
          getUser(data.user.id)
          router.back()
          router.push('/(tabs)')
    };

    const signOut = async () => {
        console.log("signout")
        const { error } = await supabase.auth.signOut();
        if(error) console.log(error)
        if (error) throw error;
        setUser(null)

        router.push('/(auth)')
    };

    useEffect(()=>{
        const { data: authData } = supabase.auth.onAuthStateChange((event, session) =>{
            if(!session) return router.push('/(auth)');
            getUser(session.user.id);
        });
        return () => {
            authData.subscription.unsubscribe();
        };
    },[])

    return (
        <AuthContext.Provider value={{ user, signIn, signUp, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}