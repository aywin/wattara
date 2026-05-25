import Link from "next/link";
import { AlertTriangle, MapPin, Users, Zap } from "lucide-react";

const stats = [
  { label: "Zones couvertes", value: "50+", icon: MapPin },
  { label: "Mises à jour", value: "Temps réel", icon: Zap },
  { label: "Communauté", value: "Citoyens", icon: Users },
];

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-primary">
      <div className="hero-bg-pattern absolute inset-0 opacity-10" />

      <div className="relative container mx-auto px-6 py-20 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-secondary">
          <AlertTriangle size={15} className="text-secondary" />
          Suivi des coupures en temps réel
        </div>

        <h1 className="mx-auto max-w-4xl text-4xl font-bold leading-tight text-white md:text-6xl">
          Restez informé des{" "}
          <span className="text-secondary">coupures d&apos;électricité</span>{" "}
          dans votre zone
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-white/75 md:text-xl">
          Wattara connecte les citoyens pour signaler, confirmer et suivre les
          pannes d&apos;électricité en temps réel.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/auth/signup"
            className="rounded-lg bg-secondary px-8 py-3.5 font-semibold text-primary shadow-lg transition hover:bg-yellow-300"
          >
            Commencer gratuitement
          </Link>
          <Link
            href="/auth/login"
            className="rounded-lg border border-white/30 px-8 py-3.5 font-semibold text-white transition hover:bg-white/10"
          >
            Se connecter
          </Link>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-3">
          {stats.map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm"
            >
              <Icon size={28} className="mx-auto mb-3 text-secondary" />
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="mt-1 text-sm text-white/70">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
