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

    const { data: anon, error } = await supabase.auth.signInAnonymously();
    if (error || !anon.user) throw new Error("Could not start a console session");
    return { user: anon.user };
  },
  component: () => <Outlet />,
});
