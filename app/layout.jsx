import "./globals.css";
export const metadata = {
  title: { default: "VELFROK — Your Daily Essential", template: "%s | VELFROK" },
  description: "Shop daily essentials at VELFROK. Quality products, fair prices.",
  icons: { icon: "/favicon.ico" },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://velfrok.vercel.app"),
};
export const viewport = { width: "device-width", initialScale: 1 }; // mobile optimized
export default function RootLayout({ children }) {
  return (<html lang="en"><body>{children}</body></html>);
}
