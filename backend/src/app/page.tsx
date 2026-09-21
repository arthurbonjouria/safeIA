import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getStats } from "@/lib/stats";
import DashboardClient from "@/components/DashboardClient";

export default async function Home() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const stats = await getStats(user, "7d");

  return <DashboardClient initialStats={stats} />;
}
