import ReportForm from "@/components/reports/ReportsForm";
import ReportsList from "@/components/reports/ReportsList";

export default function ReportsPage() {
  return (
    <div className="container mx-auto max-w-4xl space-y-6 px-4 py-6">
      <ReportForm />
      <h2 className="text-xl font-semibold">Actions citoyennes récentes</h2>
      <ReportsList />
    </div>
  );
}
