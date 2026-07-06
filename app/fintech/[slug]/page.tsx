import type { Metadata } from "next";
import Profile from "@/components/Profile";
import { getFintech, listNeobanks } from "@/lib/queries";

export const revalidate = 3600;

export async function generateStaticParams() {
  // Tolerate a DB blip at build time: emit no params → pages render on-demand
  // (ISR) once the DB is reachable, rather than failing the whole deploy.
  try {
    const list = await listNeobanks();
    return list.map((f) => ({ slug: f.id }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const ft = await getFintech(slug);
  if (!ft) return { title: "Fintech not found" };
  return {
    title: `${ft.name} Review 2026 — Ratings & Reviews`,
    description: `${ft.name}${ft.country ? ` (${ft.country})` : ""} — TrustScore, reviews and sentiment. ${ft.description ?? ""}`.slice(0, 160),
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <Profile slug={slug} kind="neobank" />;
}
