"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X, Zap } from "lucide-react";
import LogoutButton from "@/components/auth/LogoutButton";

const navLinks = [
  { href: "/reports", label: "Signalements" },
  { href: "/outages", label: "Pannes" },
];

export default function Header() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const refreshAuthState = () => {
      const token = localStorage.getItem("authToken") || localStorage.getItem("access_token");
      const userId = localStorage.getItem("userId");
      setIsAuthenticated(Boolean(token && userId));
    };

    refreshAuthState();
    window.addEventListener("storage", refreshAuthState);
    window.addEventListener("focus", refreshAuthState);
    return () => {
      window.removeEventListener("storage", refreshAuthState);
      window.removeEventListener("focus", refreshAuthState);
    };
  }, []);

  const isActive = (href: string) => pathname === href;

  return (
    <header className="bg-primary text-white shadow-md">
      <nav className="container mx-auto flex items-center justify-between px-4 py-3">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 text-xl font-bold text-secondary">
          <Zap size={22} />
          Wattara
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-6 md:flex">
          <ul className="flex gap-6">
            {navLinks.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className={`transition ${
                    isActive(href)
                      ? "font-semibold text-secondary underline underline-offset-4"
                      : "hover:text-secondary"
                  }`}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>

          {isAuthenticated ? (
            <LogoutButton />
          ) : (
            <div className="flex items-center gap-3">
              <Link href="/auth/login" className="transition hover:text-secondary">
                Connexion
              </Link>
              <Link
                href="/auth/signup"
                className="rounded-md bg-secondary px-4 py-2 font-semibold text-primary transition hover:bg-yellow-300"
              >
                S&apos;inscrire
              </Link>
            </div>
          )}
        </div>

        {/* Hamburger mobile */}
        <button
          type="button"
          className="md:hidden"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
        >
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {/* Menu mobile déroulant */}
      {menuOpen && (
        <div className="border-t border-white/10 bg-primary px-4 py-4 md:hidden">
          <ul className="space-y-3">
            {navLinks.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className={`block py-1 transition ${
                    isActive(href) ? "font-semibold text-secondary" : "hover:text-secondary"
                  }`}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-4 border-t border-white/10 pt-4">
            {isAuthenticated ? (
              <LogoutButton />
            ) : (
              <div className="flex flex-col gap-3">
                <Link
                  href="/auth/login"
                  onClick={() => setMenuOpen(false)}
                  className="hover:text-secondary"
                >
                  Connexion
                </Link>
                <Link
                  href="/auth/signup"
                  onClick={() => setMenuOpen(false)}
                  className="inline-block rounded-md bg-secondary px-4 py-2 text-center font-semibold text-primary transition hover:bg-yellow-300"
                >
                  S&apos;inscrire
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
