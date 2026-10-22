import Link from "next/link";
import Image from "next/image";
export default function ProductCard({ p }) {
  return (
    <Link href={`/product/${p.slug}`} className="card" prefetch>
      <Image src={p.image_url || "/placeholder.webp"} alt={p.name}
        width={400} height={400} className="card-img" loading="lazy" />
      <div className="card-body">
        <h3>{p.name}</h3>
        <p className="price">₹{p.price_inr}
          {p.mrp_inr > p.price_inr && <s className="mrp">₹{p.mrp_inr}</s>}
        </p>
        <span className={p.stock > 0 ? "in-stock" : "oos"}>
          {p.stock > 0 ? "In stock" : "Out of stock"}
        </span>
      </div>
    </Link>
  );
}
