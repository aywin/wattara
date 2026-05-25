import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ErrorBoundary from "@/components/ErrorBoundary";

export const metadata: Metadata = {
  title: "Wattara",
  description: "Plateforme de gestion des pannes et rapports",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="bg-background text-foreground font-sans">
        <div className="flex flex-col min-h-screen">
          <Header />
          <main className="flex-1">
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
