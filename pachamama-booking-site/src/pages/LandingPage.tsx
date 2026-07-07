import { Link } from 'react-router-dom';
import { useBookingSiteData } from '@/hooks/useBookingSiteData';
import { publishedPrograms } from '@/lib/retreatLogic';

export default function LandingPage() {
  const { forms, retreatTypes, retreatRuns, ready, error } = useBookingSiteData();

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <p className="text-sm text-rose-600 font-medium">{error}</p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    );
  }

  const retreatPrograms = publishedPrograms(retreatTypes, retreatRuns);
  const stayForms = forms.filter(f => !retreatTypes.some(p => p.bookingFormId === f.id));

  return (
    <div className="min-h-screen bg-[#f5f5f0]">
      <header className="bg-white border-b border-gray-200 px-6 py-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Pachamama Retreat</h1>
        <p className="text-sm text-gray-500 mt-2">Choose how you would like to stay with us</p>
      </header>

      <main className="max-w-lg mx-auto px-4 py-10 space-y-6">
        {retreatPrograms.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-1">Retreats</h2>
            <Link
              to="/retreats"
              className="block bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-md transition-shadow"
            >
              <h3 className="text-lg font-bold text-gray-900">Browse retreats</h3>
              <p className="text-xs text-gray-500 mt-1">
                {retreatPrograms.length} program{retreatPrograms.length === 1 ? '' : 's'} with upcoming dates
              </p>
            </Link>
          </section>
        )}

        {stayForms.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-1">Stays</h2>
            {stayForms.map(form => (
              <Link
                key={form.id}
                to={`/${form.slug}`}
                className="block bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-md transition-shadow"
              >
                <h3 className="text-lg font-bold text-gray-900">{form.name}</h3>
                <p className="text-xs text-gray-500 mt-1">
                  {form.minNights}–{form.maxNights} nights · {form.accommodationIds.length} accommodation{form.accommodationIds.length === 1 ? '' : 's'}
                </p>
              </Link>
            ))}
          </section>
        )}

        {retreatPrograms.length === 0 && stayForms.length === 0 && (
          <p className="text-center text-sm text-gray-400 italic py-12">
            No booking options available yet. Please check back soon.
          </p>
        )}
      </main>
    </div>
  );
}
