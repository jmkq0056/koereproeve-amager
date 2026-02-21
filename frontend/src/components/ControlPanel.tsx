import type { MarkerFilter } from "../types";

interface Props {
  includeMotorway: boolean;
  setIncludeMotorway: (v: boolean) => void;
  filters: MarkerFilter;
  setFilters: (f: MarkerFilter) => void;
  onGenerateRoute: () => void;
  loading: boolean;
  routeInfo?: { duration_minutes: number; distance_meters: number } | null;
}

const FILTER_ITEMS: { key: keyof MarkerFilter; label: string; color: string }[] = [
  { key: "hojre_vigepligt", label: "Højre vigepligt", color: "bg-red-500" },
  { key: "ubetinget_vigepligt", label: "Ubetinget vigepligt", color: "bg-blue-500" },
  { key: "trafiklys", label: "Trafiklys", color: "bg-green-500" },
  { key: "stopskilt", label: "Stopskilt", color: "bg-yellow-500" },
  { key: "speed_limits", label: "Hastighedsgrænser", color: "bg-purple-500" },
];

export default function ControlPanel({
  includeMotorway,
  setIncludeMotorway,
  filters,
  setFilters,
  onGenerateRoute,
  loading,
  routeInfo,
}: Props) {
  return (
    <div className="absolute top-4 left-4 z-10 bg-white/95 backdrop-blur rounded-xl shadow-lg p-4 w-80 max-h-[90vh] overflow-y-auto">
      <h1 className="text-lg font-bold text-gray-900 mb-3">Køreprøve Amager</h1>
      <p className="text-xs text-gray-500 mb-4">
        Amager Strandvej 390, 2770 Kastrup
      </p>

      {/* Motorway toggle */}
      <div className="mb-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={includeMotorway}
            onChange={(e) => setIncludeMotorway(e.target.checked)}
            className="w-4 h-4 accent-blue-600"
          />
          <span className="text-sm font-medium text-gray-700">
            Med motorvej (E20)
          </span>
        </label>
      </div>

      {/* Generate route */}
      <button
        onClick={onGenerateRoute}
        disabled={loading}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 mb-4"
      >
        {loading ? "Beregner rute..." : "Beregn rute"}
      </button>

      {/* Route info */}
      {routeInfo && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-700">
            <span className="font-medium">{routeInfo.duration_minutes} min</span>
            {" · "}
            <span>{(routeInfo.distance_meters / 1000).toFixed(1)} km</span>
          </div>
          <div
            className={`text-xs mt-1 ${
              routeInfo.duration_minutes >= 25 && routeInfo.duration_minutes <= 40
                ? "text-green-600"
                : "text-red-600"
            }`}
          >
            {routeInfo.duration_minutes >= 25 && routeInfo.duration_minutes <= 40
              ? "Inden for køreprøve tid (25-40 min)"
              : "Uden for køreprøve tid"}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="border-t pt-3">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Vis på kort</h2>
        {FILTER_ITEMS.map((item) => (
          <label key={item.key} className="flex items-center gap-2 mb-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters[item.key]}
              onChange={(e) =>
                setFilters({ ...filters, [item.key]: e.target.checked })
              }
              className="w-4 h-4"
            />
            <span className={`w-3 h-3 rounded-full ${item.color}`} />
            <span className="text-sm text-gray-600">{item.label}</span>
          </label>
        ))}
      </div>

      {/* Legend */}
      <div className="border-t pt-3 mt-3">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Forklaring</h2>
        <div className="text-xs text-gray-500 space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500" />
            Højre vigepligt (ingen skilte)
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500" />
            Ubetinget vigepligt (hajtænder)
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500" />
            Trafiklys
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-yellow-500" />
            Stopskilt
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-purple-500" />
            Hastighedsgrænse
          </div>
        </div>
      </div>
    </div>
  );
}
