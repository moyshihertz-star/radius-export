import { createFileRoute, Outlet } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    if (!import.meta.env["VITE_SUPABASE_URL"]) {
      return { user: { id: "00000000-0000-4000-8000-000000000002" } };
    }
    // No sign-up / login step: if there is no session yet, silently provision
    // one so the visitor lands straight in the console with their own org.
    const { data } = await supabase.auth.getUser();
    if (data.user) return { user: data.user };

    const { data: anon } = await supabase.auth.signInAnonymously();
    if (anon.user) return { user: anon.user };

    const { data: fallback, error: fbErr } = await supabase.auth.signInWithPassword({
      email: "demo@radius.local",
      password: "RadiusDemo2026!",
    });
    if (fbErr || !fallback.user) throw new Error("Could not start a console session");
    return { user: fallback.user };
  },
  component: () => <Outlet />,
});
