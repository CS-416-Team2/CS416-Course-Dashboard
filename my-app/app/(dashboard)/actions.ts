"use server";

import { signOut } from "@/auth";
import { requireActiveSession } from "@/lib/auth/session";

export async function signOutAction() {
  await requireActiveSession();
  await signOut({ redirectTo: "/login" });
}
