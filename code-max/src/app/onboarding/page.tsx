import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPortfolio, getProfile, getServices } from "@/lib/data";
import { Onboarding } from "./Onboarding";

export const metadata: Metadata = { title: "Primeiros passos" };

export default async function OnboardingPage() {
  const profile = await getProfile();
  if (profile.onboarding_concluido) redirect("/");
  const [services, portfolio] = await Promise.all([getServices(), getPortfolio()]);
  return <Onboarding profile={profile} services={services} portfolio={portfolio} />;
}
