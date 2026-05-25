import { Map, Shield, Zap } from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "Signalement rapide",
    desc: "Déclarez une coupure en quelques secondes. Précisez votre zone et ajoutez un commentaire pour aider toute la communauté.",
    color: "bg-yellow-50 text-yellow-600",
  },
  {
    icon: Map,
    title: "Carte interactive",
    desc: "Visualisez en temps réel les zones touchées. Identifiez les secteurs à risque et suivez l'évolution des pannes près de chez vous.",
    color: "bg-blue-50 text-blue-600",
  },
  {
    icon: Shield,
    title: "Données officielles",
    desc: "Comparez les signalements citoyens avec les coupures officielles de la SONABEL. Distinguez panne imprévue et coupure planifiée.",
    color: "bg-teal-50 text-teal-600",
  },
];

export default function Features() {
  return (
    <section className="bg-gray-50 py-20">
      <div className="container mx-auto px-6">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold text-gray-900 md:text-4xl">
            Pourquoi choisir{" "}
            <span className="text-primary">Wattara</span> ?
          </h2>
          <p className="mt-4 text-gray-500">
            Une plateforme pensée pour les citoyens.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {features.map(({ icon: Icon, title, desc, color }) => (
            <div
              key={title}
              className="rounded-xl border border-gray-100 bg-white p-8 shadow-sm transition hover:shadow-md"
            >
              <div className={`mb-5 inline-flex rounded-xl p-3 ${color}`}>
                <Icon size={28} />
              </div>
              <h3 className="mb-3 text-xl font-bold text-gray-900">{title}</h3>
              <p className="leading-relaxed text-gray-600">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
