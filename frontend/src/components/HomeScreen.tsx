import { useState } from "react";
import type { RouteData, VillaStreet } from "../types";

interface Props {
  onGenerateRoute: (includeMotorway: boolean) => void;
  onStartTrainer: () => void;
  hojreCount: number;
  loading: boolean;
  dataLoading: boolean;
  error: string | null;
  savedRoutes: RouteData[];
  onLoadRoute: (route: RouteData) => void;
  onDeleteRoute: (index: number) => void;
  villaStreets: VillaStreet[];
}

// --- SVG Icons ---
const IconRoute = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M12 19h4.5a3.5 3.5 0 0 0 0-7h-9a3.5 3.5 0 0 1 0-7H12"/>
  </svg>
);

const IconClock = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);

const IconTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
);

const IconChevronDown = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

const IconChevronUp = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="18 15 12 9 6 15"/>
  </svg>
);

const IconExternalLink = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
);

const IconMapPin = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
  </svg>
);

const IconHighway = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19L8 5"/><path d="M16 5l4 14"/><line x1="9" y1="19" x2="15" y2="19"/><line x1="10" y1="14" x2="14" y2="14"/><line x1="11" y1="9" x2="13" y2="9"/>
  </svg>
);

export default function HomeScreen({
  onGenerateRoute,
  onStartTrainer,
  hojreCount,
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
    <div className="h-full bg-slate-950 text-white overflow-y-auto">
      <div className="max-w-lg mx-auto px-4 pt-[max(env(safe-area-inset-top),16px)] pb-[max(env(safe-area-inset-bottom),24px)]">
        {/* Header */}
        <div className="pt-4 pb-6">
          <h1 className="text-2xl font-bold tracking-tight">Køreprøve Amager</h1>
          <div className="flex items-center gap-1.5 mt-1.5 text-slate-400 text-sm">
            <IconMapPin />
            <span>Vindblæs Alle 2, 2770 Kastrup</span>
          </div>
        </div>

        {/* Generate Route */}
        <div className="bg-slate-800/80 rounded-2xl p-5 mb-4 border border-slate-700/50">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
            Ny rute
          </h2>

          <label className="flex items-center gap-3 mb-5 cursor-pointer">
            <div
              className={`w-12 h-7 rounded-full relative transition-colors ${
                includeMotorway ? "bg-blue-500" : "bg-slate-600"
              }`}
              onClick={() => setIncludeMotorway(!includeMotorway)}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-transform shadow-sm ${
                  includeMotorway ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <IconHighway />
                <span className="text-sm font-medium">Med motorvej (E20)</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {includeMotorway
                  ? "Via Amager Motorvejen \u2192 Tårnby Rundkørsel"
                  : "Direkte gennem villakvarterer"}
              </p>
            </div>
          </label>

          <button
            onClick={() => onGenerateRoute(includeMotorway)}
            disabled={loading}
            className="w-full bg-blue-500 hover:bg-blue-600 active:bg-blue-700 disabled:opacity-50 text-white py-3.5 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Beregner rute...
              </>
            ) : (
              <>
                <IconRoute />
                Beregn rute
              </>
            )}
          </button>

          {error && (
            <p className="text-red-400 text-sm mt-3 text-center">{error}</p>
          )}

          <p className="text-xs text-slate-500 mt-3 text-center">
            Målsætning: 25-35 min (max 40 min) — varierer hver gang
          </p>
        </div>

        {/* Højre Vigepligt Trainer */}
        <div className="bg-slate-800/80 rounded-2xl p-5 mb-4 border border-red-500/30">
          <h2 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-3">
            Højre Vigepligt Træning
          </h2>
          <p className="text-xs text-slate-400 mb-4">
            Øv alle {hojreCount || "..."} højre vigepligt kryds én for én.
            Se hvert kryds på kort og i gadevisning indtil du kender dem alle.
          </p>
          <button
            onClick={onStartTrainer}
            disabled={hojreCount === 0}
            className="w-full bg-red-500 hover:bg-red-600 active:bg-red-700 disabled:opacity-50 text-white py-3.5 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2"
          >
            <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">H</span>
            Start træning ({hojreCount} kryds)
          </button>
        </div>

        {/* Saved Routes */}
        {savedRoutes.length > 0 && (
          <div className="bg-slate-800/80 rounded-2xl p-5 mb-4 border border-slate-700/50">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Gemte ruter ({savedRoutes.length})
            </h2>
            <div className="space-y-2">
              {savedRoutes.map((route, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between bg-slate-700/40 rounded-xl p-3 border border-slate-600/30"
                >
                  <button
                    onClick={() => onLoadRoute(route)}
                    className="flex-1 text-left flex items-center gap-2"
                  >
                    <IconClock />
                    <span className="text-sm font-medium">
                      {route.duration_minutes} min
                    </span>
                    <span className="text-slate-500 text-xs">|</span>
                    <span className="text-sm text-slate-300">
                      {(route.distance_meters / 1000).toFixed(1)} km
                    </span>
                    <span className={`text-xs ml-1 px-1.5 py-0.5 rounded ${route.include_motorway ? "bg-blue-500/20 text-blue-300" : "bg-slate-600 text-slate-300"}`}>
                      {route.include_motorway ? "Motorvej" : "Uden"}
                    </span>
                  </button>
                  <button
                    onClick={() => onDeleteRoute(i)}
                    className="text-slate-500 hover:text-red-400 p-2 transition-colors"
                  >
                    <IconTrash />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Villa Areas */}
        <div className="bg-slate-800/80 rounded-2xl p-5 mb-4 border border-slate-700/50">
          <button
            onClick={() => setShowVillas(!showVillas)}
            className="w-full flex items-center justify-between"
          >
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Villakvarterer ({dataLoading ? "..." : villaStreets.length})
            </h2>
            <span className="text-slate-400">
              {showVillas ? <IconChevronUp /> : <IconChevronDown />}
            </span>
          </button>

          {showVillas && (
            <div className="mt-3 max-h-80 overflow-y-auto space-y-1">
              {villaStreets.map((s) => (
                <a
                  key={s.id || s.name}
                  href={`https://www.google.com/maps/@${s.lat},${s.lng},17z`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between bg-slate-700/40 rounded-lg px-3 py-2.5 hover:bg-slate-700 transition-colors border border-slate-600/20"
                >
                  <span className="text-sm">{s.name}</span>
                  <span className="text-slate-400 text-xs shrink-0 ml-2 flex items-center gap-1">
                    {s.distance_m ? `${(s.distance_m / 1000).toFixed(1)} km` : ""}
                    <IconExternalLink />
                  </span>
                </a>
              ))}
              {villaStreets.length === 0 && !dataLoading && (
                <p className="text-xs text-slate-500 py-2">Ingen villakvarterer fundet</p>
              )}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="bg-slate-800/80 rounded-2xl p-5 mb-6 border border-slate-700/50">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
            Forklaring
          </h2>

          {/* Start marker */}
          <div className="flex items-center gap-3 mb-3 pb-3 border-b border-slate-700/50">
            <span className="w-7 h-7 rounded-full bg-green-600 shrink-0 flex items-center justify-center text-white text-xs font-bold border-2 border-white shadow-sm">
              S
            </span>
            <span className="text-slate-300 text-sm">Start / Slut punkt</span>
          </div>

          {/* Intersection markers with letters */}
          <div className="grid grid-cols-2 gap-3 text-sm mb-3">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full bg-red-500 shrink-0 flex items-center justify-center text-white text-[10px] font-bold border-2 border-white shadow-sm">
                H
              </span>
              <span className="text-slate-300">Højre vigepligt</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full bg-blue-500 shrink-0 flex items-center justify-center text-white text-[10px] font-bold border-2 border-white shadow-sm">
                U
              </span>
              <span className="text-slate-300">Ubetinget vigepligt</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full bg-green-500 shrink-0 flex items-center justify-center text-white text-[10px] font-bold border-2 border-white shadow-sm">
                T
              </span>
              <span className="text-slate-300">Trafiklys</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full bg-yellow-500 shrink-0 flex items-center justify-center text-white text-[10px] font-bold border-2 border-white shadow-sm">
                S
              </span>
              <span className="text-slate-300">Stopskilt</span>
            </div>
          </div>

          {/* Speed limit legend */}
          <div className="border-t border-slate-700/50 pt-3">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-full bg-white border-[3px] border-red-600 shrink-0 flex items-center justify-center text-[10px] font-bold text-black shadow-sm">
                50
              </span>
              <span className="text-slate-300 text-sm">Fartskilt (rød ring med tal)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
