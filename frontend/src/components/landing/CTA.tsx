import Link from "next/link";

export default function CTA() {
  return (
    <section className="bg-primary py-20 text-center">
      <div className="container mx-auto px-6">
        <h2 className="text-3xl font-bold text-white md:text-4xl">
          Rejoignez la communauté Wattara
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-white/75">
          Ensemble, rendons l&apos;électricité plus fiable. Chaque signalement compte.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/auth/signup"
            className="rounded-lg bg-secondary px-8 py-3.5 font-semibold text-primary shadow-lg transition hover:bg-yellow-300"
          >
            Créer un compte gratuitement
          </Link>
          <Link
            href="/reports"
            className="rounded-lg border border-white/30 px-8 py-3.5 font-semibold text-white transition hover:bg-white/10"
          >
            Voir les signalements
          </Link>
        </div>
      </div>
    </section>
  );
}
