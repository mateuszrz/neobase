import type { Metadata } from "next";
import Profile from "@/components/Profile";
import { getFintech, listExchanges } from "@/lib/queries";

export const revalidate = 3600;

export async function generateStaticParams() {
  const list = await listExchanges();
  return list.map((f) => ({ slug: f.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const ft = await getFintech(slug);
  if (!ft) return { title: "Exchange not found" };
  return {
    title: `${ft.name} Review 2026 — Crypto Exchange Ratings`,
    description: `${ft.name} — TrustScore, fees, reviews and user sentiment. ${ft.description ?? ""}`.slice(0, 160),
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <Profile slug={slug} kind="exchange" />;
}
