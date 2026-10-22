"use client";
import { useState } from "react";
import Link from "next/link";
export default function MobileMenu({ links }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="hamburger" aria-label="Menu" aria-expanded={open}
        onClick={() => setOpen(!open)}>☰</button>
      {open && (
        <nav className="mobile-nav" onClick={() => setOpen(false)}>
          {links.map(l => <Link key={l.href} href={l.href} tabIndex={0}>{l.label}</Link>)}
        </nav>
      )}
    </>
  );
}
