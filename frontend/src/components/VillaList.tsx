import type { VillaStreet, Neighborhood } from "../types";

interface Props {
  streets: VillaStreet[];
  neighborhoods: Neighborhood[];
  loading: boolean;
}

export default function VillaList({ streets, neighborhoods, loading }: Props) {
  if (loading) {
    return (
      <div className="absolute bottom-4 left-4 z-10 bg-white/95 backdrop-blur rounded-xl shadow-lg p-4 w-80">
        <p className="text-sm text-gray-500">Finder villa kvarterer...</p>
      </div>
    );
  }

  if (streets.length === 0 && neighborhoods.length === 0) return null;

  return (
    <div className="absolute bottom-4 left-4 z-10 bg-white/95 backdrop-blur rounded-xl shadow-lg p-4 w-80 max-h-60 overflow-y-auto">
      <h2 className="text-sm font-semibold text-gray-700 mb-2">
        Villa kvarterer ({streets.length} veje)
      </h2>

      {neighborhoods.length > 0 && (
        <div className="mb-2">
          {neighborhoods.map((n, i) => (
            <div key={i} className="text-xs text-gray-600 py-1 border-b border-gray-100">
              {n.name} <span className="text-gray-400">· {n.address}</span>
            </div>
          ))}
        </div>
      )}

      <div>
        {streets.slice(0, 50).map((s) => (
          <div key={s.id} className="text-xs text-gray-600 py-1 border-b border-gray-100">
            {s.name}
          </div>
        ))}
        {streets.length > 50 && (
          <p className="text-xs text-gray-400 mt-1">
            + {streets.length - 50} flere veje
          </p>
        )}
      </div>
    </div>
  );
}
