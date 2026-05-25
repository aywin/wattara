import OutageForm from "@/components/outage/OutageForm";
import OutageCard from "@/components/outage/OutageCard";
import { API_URL } from "@/lib/api";

interface Region {
  id: string;
  name: string;
}

interface Zone {
  id: string;
  name: string;
  sector_number?: string;
  region?: Region;
  color_code?: string;
}

interface Outage {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time?: string;
  source?: string;
  zones?: Zone[];
  confirmation_count?: number;
}

export default async function OutagesPage() {
  const res = await fetch(`${API_URL}/outages/`, { cache: "no-store" });
  const data = await res.json();
  const outages: Outage[] = Array.isArray(data) ? data : [];

  return (
    <div className="container mx-auto max-w-4xl space-y-6 px-4 py-6">
      <OutageForm />

      <div>
        <h2 className="mb-4 text-2xl font-semibold">Pannes officielles</h2>
        {outages.length === 0 ? (
          <p className="text-gray-600">Aucune panne pour le moment.</p>
        ) : (
          <div className="grid gap-4">
            {outages.map((outage) => (
              <OutageCard
                key={outage.id}
                id={outage.id}
                title={outage.title}
                description={outage.description}
                zones={outage.zones}
                startTime={outage.start_time}
                endTime={outage.end_time}
                source={outage.source}
                confirmation_count={outage.confirmation_count}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
