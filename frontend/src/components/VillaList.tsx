import { useState } from "react";
import type { VillaStreet, Neighborhood } from "../types";

interface Props {
  streets: VillaStreet[];
  neighborhoods: Neighborhood[];
  loading: boolean;
}

export default function VillaList({ streets, neighborhoods, loading }: Props) {
  const [open, setOpen] = useState(false);

  if (loading) {
    return (
      <div className="absolute bottom-2 left-2 z-10 bg-white/95 backdrop-blur rounded-xl shadow-lg px-3 py-2">
        <p className="text-xs text-gray-500">Finder villa kvarterer...</p>
      </div>
    );
  }

  if (streets.length === 0 && neighborhoods.length === 0) return null;

  return (
    <div className="absolute bottom-2 left-2 right-2 md:right-auto z-10">
      <div
        className="bg-white/95 backdrop-blur rounded-xl shadow-lg px-3 py-2 cursor-pointer md:w-72"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-700">
            Villa kvarterer ({streets.length})
          </span>
          <span className="text-gray-400 text-xs">{open ? "▼" : "▲"}</span>
        </div>
      </div>

      {open && (
        <div className="bg-white/95 backdrop-blur rounded-xl shadow-lg px-3 py-2 mb-1 max-h-40 overflow-y-auto md:w-72">
          {neighborhoods.map((n, i) => (
            <div key={i} className="text-xs text-gray-600 py-0.5 border-b border-gray-100">
              {n.name}
            </div>
          ))}
          {streets.slice(0, 30).map((s) => (
            <div key={s.id} className="text-xs text-gray-600 py-0.5 border-b border-gray-100">
              {s.name}
            </div>
          ))}
          {streets.length > 30 && (
            <p className="text-xs text-gray-400 mt-0.5">+ {streets.length - 30} flere</p>
          )}
        </div>
      )}
    </div>
  );
}
