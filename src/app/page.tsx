import { createServerClientInstance } from "@/lib/supabase";
import Dashboard from "@/components/Dashboard";
import AuthForm from "@/components/AuthForm";
import SetupWizard from "@/components/SetupWizard";

export const dynamic = "force-dynamic";

export default async function Home() {
  let user = null;
  let setupError = false;
  let dbOffline = false;

  // Check if environment variables are set
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    setupError = true;
  } else {
    try {
      // Perform a server-side health check request to local Supabase API
      const healthCheck = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`, {
        method: 'GET',
        headers: {
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        },
        next: { revalidate: 0 } // Bypass Next.js route cache
      });
      
      if (!healthCheck.ok) {
        dbOffline = true;
      } else {
        const supabase = await createServerClientInstance();
        const { data } = await supabase.auth.getUser();
        user = data?.user || null;
      }
    } catch (e) {
      console.error("Supabase connection check failed:", e);
      dbOffline = true;
    }
  }

  if (setupError) {
    return <SetupWizard />;
  }

  if (dbOffline) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 text-slate-100 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950/40 via-slate-950 to-slate-950">
        <head>
          <meta httpEquiv="refresh" content="3" />
        </head>
        <div className="w-full max-w-sm bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-2xl p-8 shadow-2xl text-center space-y-6 flex flex-col items-center">
          <div className="relative h-20 w-20 flex items-center justify-center">
            {/* Spinning background glow */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-habit-green via-finance-blue to-task-purple animate-spin blur-md opacity-40"></div>
            <div className="absolute inset-1 rounded-2xl bg-slate-950 flex items-center justify-center">
              <img src="/logo.png" alt="Pesos Logo" className="h-14 w-14 object-contain rounded-xl animate-pulse" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-100">Cargando base de datos</h1>
            <p className="text-xs text-slate-400 max-w-[250px] mx-auto leading-relaxed">
              Iniciando los servicios locales. Esta ventana se actualizará automáticamente cuando esté listo.
            </p>
          </div>
          {/* Reconnecting Spinner indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.02] border border-white/5 text-[10px] text-slate-400 font-medium">
            <div className="h-1.5 w-1.5 rounded-full bg-finance-blue animate-ping" />
            Conectando a Supabase...
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  return <Dashboard initialUser={{ id: user.id, email: user.email }} />;
}
