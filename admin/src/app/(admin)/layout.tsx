import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { AdminHeader } from '@/components/admin-header';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import type { AdminRole } from '../../../types/database';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  let email = '';
  let adminRole: AdminRole = 'support';

  if (user) {
    email = user.email ?? '';
    const { data: profile } = await supabase
      .from('profiles')
      .select('admin_role')
      .eq('id', user.id)
      .single();
    if (profile?.admin_role) {
      adminRole = profile.admin_role as AdminRole;
    }
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AdminHeader email={email} adminRole={adminRole} />
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
