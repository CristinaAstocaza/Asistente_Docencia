"use client";
import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, Teacher } from '@/services/api';
const Context=createContext<{user:Teacher|null;setUser:(user:Teacher)=>void}>({user:null,setUser:()=>{}});
export const useTeacher=()=>useContext(Context);
export default function AuthProvider({children}:{children:React.ReactNode}) {
 const [user,setUser]=useState<Teacher|null>({id:'00000000-0000-4000-8000-000000000001',name:'Docente',email:'docente@colegio.edu.pe',institution:'Institución Educativa'});
 useEffect(()=>{let active=true;api<Teacher>('/auth/me').then(u=>{if(active&&u)setUser(u);}).catch(()=>{});return()=>{active=false;};},[]);
 return <Context.Provider value={{user,setUser}}>{children}</Context.Provider>;
}
