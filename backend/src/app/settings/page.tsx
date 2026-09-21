import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import SettingsClient from "@/components/SettingsClient";

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <SettingsClient
      apiToken={user.apiToken}
      name={user.name}
      email={user.email}
      role={user.role}
    />
  );
}
