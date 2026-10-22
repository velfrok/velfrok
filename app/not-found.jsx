import Link from "next/link";
export default function NotFound() {
  return (
    <main className="nf">
      <h1>404</h1>
      <p>This page wandered off. Let's get you back to the essentials.</p>
      <Link href="/" className="btn">Go Home</Link>
      <Link href="/track" className="btn ghost">Track an Order</Link>
    </main>
  );
}
