"use client";

import Link from "next/link";
import { useRef } from "react";
import gsap from "gsap";

const links = [
  { href: "/", label: "Home" },
  { href: "/events", label: "Eventos" },
  { href: "/chat", label: "HackBot" },
  { href: "/about", label: "Sobre mí" },
];

function NavLink({ href, label }: { href: string; label: string }) {
  const ref = useRef<HTMLAnchorElement>(null);

  function onEnter() {
    gsap.to(ref.current, {
      y: -3,
      color: "#f1f5f9",
      duration: 0.22,
      ease: "power2.out",
    });
  }

  function onLeave() {
    gsap.to(ref.current, {
      y: 0,
      color: "",
      duration: 0.28,
      ease: "power2.out",
    });
  }

  return (
    <Link
      ref={ref}
      href={href}
      className="rounded-lg px-3 py-1.5 text-[13px] font-medium tracking-[0.01em] text-slate-200/70 transition-colors hover:bg-white/[0.08] sm:px-4 sm:text-[14px]"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {label}
    </Link>
  );
}

export function NavLinks() {
  return (
    <nav
      aria-label="Principal"
      className="absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-0.5 sm:gap-1"
    >
      {links.map((link) => (
        <NavLink key={link.href} href={link.href} label={link.label} />
      ))}
    </nav>
  );
}
