import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { signOutAction } from "@/app/(dashboard)/actions";
import { ForbiddenError, UnauthorizedError, requireActiveSession } from "@/lib/auth/session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireActiveSession();
  } catch (error) {
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
      redirect("/login");
    }
    throw error;
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1">
        <div className="flex justify-end p-6 pb-0">
          <form action={signOutAction}>
            <button
              type="submit"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-100"
            >
              Sign out
            </button>
          </form>
        </div>
        {children}
      </main>
    </div>
  );
}
