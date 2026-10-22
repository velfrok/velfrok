import ProductCard from "./ProductCard";
export default function Recommendations({ category, excludeSlug, count = 4 }) {
  // fetch same-category products, excluding current
  return (
    <section className="recs">
      <h2>You may also like</h2>
      <div className="grid">{recs.map(p => <ProductCard key={p.id} p={p} />)}</div>
    </section>
  );
}
