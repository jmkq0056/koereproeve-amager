import { useState } from "react";
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
  { key: "speed_limits", label: "Hastighed", color: "bg-purple-500" },
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
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute top-2 left-2 right-2 md:right-auto z-10">
      {/* Collapsed bar */}
      <div
        className="bg-white/95 backdrop-blur rounded-xl shadow-lg p-3 flex items-center justify-between gap-2 cursor-pointer md:w-72"
        onClick={() => setOpen(!open)}
      >
        <div className="min-w-0">
          <h1 className="text-sm font-bold text-gray-900 truncate">Køreprøve Amager</h1>
          {routeInfo && (
            <span className="text-xs text-gray-500">
              {routeInfo.duration_minutes} min · {(routeInfo.distance_meters / 1000).toFixed(1)} km
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onGenerateRoute();
            }}
            disabled={loading}
            className="bg-blue-600 text-white py-1.5 px-3 rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "..." : "Beregn"}
          </button>
          <span className="text-gray-400 text-xs">{open ? "▲" : "▼"}</span>
        </div>
      </div>

      {/* Expanded panel */}
      {open && (
        <div className="bg-white/95 backdrop-blur rounded-xl shadow-lg p-3 mt-1 md:w-72">
          {/* Motorway toggle */}
          <label className="flex items-center gap-2 cursor-pointer mb-3">
            <input
              type="checkbox"
              checked={includeMotorway}
              onChange={(e) => setIncludeMotorway(e.target.checked)}
              className="w-4 h-4 accent-blue-600"
            />
            <span className="text-sm text-gray-700">Med motorvej (E20)</span>
          </label>

          {/* Route info */}
          {routeInfo && (
            <div className="mb-3 p-2 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-700">
                <span className="font-medium">{routeInfo.duration_minutes} min</span>
                {" · "}
                <span>{(routeInfo.distance_meters / 1000).toFixed(1)} km</span>
              </div>
              <div
                className={`text-xs mt-0.5 ${
                  routeInfo.duration_minutes >= 25 && routeInfo.duration_minutes <= 40
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {routeInfo.duration_minutes >= 25 && routeInfo.duration_minutes <= 40
                  ? "Inden for tid (25-40 min)"
                  : "Uden for tid"}
              </div>
            </div>
          )}

          {/* Filters as compact chips */}
          <h2 className="text-xs font-semibold text-gray-500 uppercase mb-1.5">Vis på kort</h2>
          <div className="flex flex-wrap gap-1.5">
            {FILTER_ITEMS.map((item) => (
              <label
                key={item.key}
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs cursor-pointer border ${
                  filters[item.key]
                    ? "bg-gray-100 border-gray-300 text-gray-700"
                    : "bg-white border-gray-200 text-gray-400"
                }`}
              >
                <input
                  type="checkbox"
                  checked={filters[item.key]}
                  onChange={(e) =>
                    setFilters({ ...filters, [item.key]: e.target.checked })
                  }
                  className="hidden"
                />
                <span className={`w-2 h-2 rounded-full ${item.color}`} />
                {item.label}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
