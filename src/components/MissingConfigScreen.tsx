/**
 * Shown when Vite public env vars were not inlined at build time.
 * Netlify only exposes VITE_* variables if they are set in Site settings
 * before (or during) the production build.
 */
export default function MissingConfigScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
      <div className="max-w-lg w-full rounded-xl border border-amber-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Configuration required</h1>
        <p className="mt-2 text-sm text-slate-600">
          This site was built without Supabase credentials, so the app cannot start.
          In Netlify go to Site configuration → Environment variables and add:
        </p>
        <ul className="mt-3 list-disc list-inside text-sm font-mono text-slate-800 space-y-1">
          <li>VITE_SUPABASE_URL</li>
          <li>VITE_SUPABASE_ANON_KEY</li>
        </ul>
        <p className="mt-3 text-sm text-slate-600">
          Trigger a new deploy after saving so Vite can inline the values into the bundle.
        </p>
      </div>
    </div>
  );
}
