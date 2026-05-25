"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Plus } from "lucide-react";
import LiveStatsBar from "./LiveStatsBar";
import FeedPanel from "./FeedPanel";
import ReportModal from "./ReportModal";

const WattaraMap = dynamic(() => import("@/components/map/WattaraMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-gray-100">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  ),
});

export default function HomePage() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    setIsLoggedIn(Boolean(localStorage.getItem("authToken")));
  }, []);

  // Empêche le flash avant lecture du localStorage
  if (isLoggedIn === null) return null;

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 88px)" }}>
      {/* Barre de stats live */}
      <LiveStatsBar />

      {/* Layout principal : carte + feed */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Carte — prend tout l'espace disponible */}
        <div className="relative min-h-[340px] flex-1">
          <WattaraMap fullscreen />
        </div>

        {/* Feed panel — largeur fixe sur desktop, hauteur auto sur mobile */}
        <div className="flex min-h-0 w-full flex-col border-t border-gray-200 lg:w-[380px] lg:border-l lg:border-t-0">
          <FeedPanel isLoggedIn={isLoggedIn} />
        </div>
      </div>

      {/* Bouton flottant pour les connectés */}
      {isLoggedIn && (
        <button
          type="button"
          onClick={() => setShowModal(true)}
          title="Signaler une situation"
          className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-secondary shadow-xl transition hover:scale-110 hover:bg-yellow-300 active:scale-95"
        >
          <Plus size={26} className="text-primary" />
        </button>
      )}

      {/* Modal signalement */}
      {showModal && <ReportModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
