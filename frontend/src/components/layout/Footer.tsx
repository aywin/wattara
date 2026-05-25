export default function Footer() {
  return (
    <footer className="bg-foreground text-background py-4 mt-6">
      <div className="container mx-auto text-center text-sm">
        © {new Date().getFullYear()} Wattara — Tous droits réservés ⚡
      </div>
    </footer>
  );
}
