"use client";
import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, Teacher } from '@/services/api';
const Context=createContext<{user:Teacher|null;setUser:(user:Teacher)=>void}>({user:null,setUser:()=>{}});
export const useTeacher=()=>useContext(Context);
export default function AuthProvider({children}:{children:React.ReactNode}) {
 const router=useRouter();
 const [user,setUser]=useState<Teacher|null>(null);
 useEffect(()=>{
  let active=true;
  api<Teacher>('/auth/me').then(u=>{if(active)setUser(u);}).catch(()=>{if(active)router.replace('/login');});
  return()=>{active=false;};
 },[router]);
 if(!user)return <main className="workspace"><p role="status">Abriendo la aplicación…</p></main>;
 return <Context.Provider value={{user,setUser}}>{children}</Context.Provider>;
}
