import ProductGrid from "@/components/ProductGrid";
import { supabaseBrowser } from "@/lib/supabase";

export const revalidate = 60; // ISR: fast + fresh

export default async function Home() {
  const { data: products } = await supabaseBrowser()
    .from("products").select("*").eq("is_active", true).order("created_at", { ascending: false });
  return (
    <>
      <section className="hero"><h1>VELFROK</h1><p>Your Daily Essential</p></section>
      <ProductGrid products={products || []} />
    </>
  );
}
