import { Loader2 } from 'lucide-react';

export default function LoadingSpinner({ message = 'Caricamento...' }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] text-gray-400">
      <Loader2 className="w-8 h-8 animate-spin mb-3" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

export function FullPageLoader({ message = 'Caricamento...' }) {
  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-xl p-8 shadow-2xl">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary-500" />
          <p className="text-white font-medium">{message}</p>
        </div>
      </div>
    </div>
  );
}
