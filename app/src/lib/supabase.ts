import{createClient,type SupabaseClient}from'@supabase/supabase-js';
const url=import.meta.env.VITE_SUPABASE_URL?.trim(),key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
export const cloudConfigured=Boolean(url&&key&&url.endsWith('.supabase.co'));
export const supabase:SupabaseClient|null=cloudConfigured?createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'}}):null;
