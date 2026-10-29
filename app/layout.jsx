import "./globals.css";
import { CartProvider } from "@/context/CartContext";

export const metadata = {
  title: "VELFROK — Everyday essentials",
  description: "Discover everyday essentials at VELFROK.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <CartProvider>
          <header className="site-header">
            <a className="wordmark" href="/" aria-label="VELFROK home">
              VELFROK<span>.</span>
            </a>

            <nav className="site-nav" aria-label="Main navigation">
              <a href="/">Shop</a>
              <a href="/cart">Cart</a>
              <a className="nav-cta" href="/checkout">
                Checkout
              </a>
            </nav>
          </header>

          <main className="site-main">{children}</main>

          <footer className="site-footer">
            <a className="wordmark" href="/">
              VELFROK<span>.</span>
            </a>

            <p>Everyday essentials, thoughtfully selected.</p>

            <small>© {new Date().getFullYear()} VELFROK</small>
          </footer>
        </CartProvider>
      </body>
    </html>
  );
}
