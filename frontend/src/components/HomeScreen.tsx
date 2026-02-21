import { useState } from "react";
import type { RouteData, VillaStreet } from "../types";

interface Props {
  onGenerateRoute: (includeMotorway: boolean) => void;
  loading: boolean;
  dataLoading: boolean;
  error: string | null;
  savedRoutes: RouteData[];
  onLoadRoute: (route: RouteData) => void;
  onDeleteRoute: (index: number) => void;
  villaStreets: VillaStreet[];
}

export default function HomeScreen({
  onGenerateRoute,
  loading,
  dataLoading,
  error,
  savedRoutes,
  onLoadRoute,
  onDeleteRoute,
  villaStreets,
}: Props) {
  const [includeMotorway, setIncludeMotorway] = useState(true);
  const [showVillas, setShowVillas] = useState(false);

  return (
    <div className="h-full bg-slate-900 text-white overflow-y-auto">
      <div className="max-w-lg mx-auto px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        {/* Header */}
        <div className="pt-6 pb-4">
          <h1 className="text-2xl font-bold">Køreprøve Amager</h1>
          <p className="text-slate-400 text-sm mt-1">
            Amager Strandvej 390, 2770 Kastrup
          </p>
        </div>

        {/* Generate Route */}
        <div className="bg-slate-800 rounded-2xl p-4 mb-4">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">
            Ny rute
          </h2>

          <label className="flex items-center gap-3 mb-4 cursor-pointer">
            <div
              className={`w-12 h-7 rounded-full relative transition-colors ${
                includeMotorway ? "bg-blue-500" : "bg-slate-600"
              }`}
              onClick={() => setIncludeMotorway(!includeMotorway)}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-transform ${
                  includeMotorway ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </div>
            <div>
              <span className="text-sm font-medium">Med motorvej (E20)</span>
              <p className="text-xs text-slate-400">
                {includeMotorway
                  ? "Via Amager Motorvejen → Tårnby Rundkørsel"
                  : "Direkte gennem villakvarterer"}
              </p>
            </div>
          </label>

          <button
            onClick={() => onGenerateRoute(includeMotorway)}
            disabled={loading}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white py-3 rounded-xl font-semibold text-sm transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Beregner rute...
              </span>
            ) : (
              "Beregn rute"
            )}
          </button>

          {error && (
            <p className="text-red-400 text-sm mt-2 text-center">{error}</p>
          )}

          <p className="text-xs text-slate-500 mt-2 text-center">
            Målsætning: 25-35 min (max 40 min)
          </p>
        </div>

        {/* Saved Routes */}
        {savedRoutes.length > 0 && (
          <div className="bg-slate-800 rounded-2xl p-4 mb-4">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">
              Gemte ruter ({savedRoutes.length})
            </h2>
            <div className="space-y-2">
              {savedRoutes.map((route, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between bg-slate-700/50 rounded-xl p-3"
                >
                  <button
                    onClick={() => onLoadRoute(route)}
                    className="flex-1 text-left"
                  >
                    <span className="text-sm font-medium">
                      {route.duration_minutes} min · {(route.distance_meters / 1000).toFixed(1)} km
                    </span>
                    <span className="text-xs text-slate-400 ml-2">
                      {route.include_motorway ? "Med motorvej" : "Uden motorvej"}
                    </span>
                  </button>
                  <button
                    onClick={() => onDeleteRoute(i)}
                    className="text-slate-500 hover:text-red-400 p-1 text-xs"
                  >
                    Slet
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Villa Areas */}
        <div className="bg-slate-800 rounded-2xl p-4 mb-4">
          <button
            onClick={() => setShowVillas(!showVillas)}
            className="w-full flex items-center justify-between"
          >
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
              Villa kvarterer ({dataLoading ? "..." : villaStreets.length})
            </h2>
            <span className="text-slate-400 text-lg">
              {showVillas ? "−" : "+"}
            </span>
          </button>

          {showVillas && (
            <div className="mt-3 max-h-80 overflow-y-auto space-y-1">
              {villaStreets.map((s) => (
                <a
                  key={s.id}
                  href={`https://www.google.com/maps/@${s.lat},${s.lng},17z`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between bg-slate-700/50 rounded-lg px-3 py-2 hover:bg-slate-700 transition-colors"
                >
                  <span className="text-sm">{s.name}</span>
                  <span className="text-blue-400 text-xs shrink-0 ml-2">Kort ↗</span>
                </a>
              ))}
              {villaStreets.length === 0 && !dataLoading && (
                <p className="text-xs text-slate-500">Ingen villa kvarterer fundet</p>
              )}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="bg-slate-800 rounded-2xl p-4 mb-6">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">
            Forklaring
          </h2>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
              <span className="text-slate-300">Højre vigepligt</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500 shrink-0" />
              <span className="text-slate-300">Ubetinget vigepligt</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-green-500 shrink-0" />
              <span className="text-slate-300">Trafiklys</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-yellow-500 shrink-0" />
              <span className="text-slate-300">Stopskilt</span>
            </div>
            <div className="flex items-center gap-2 col-span-2">
              <span className="w-3 h-3 rounded-full bg-purple-500 shrink-0" />
              <span className="text-slate-300">Hastighedsgrænse (farve = hastighed)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
