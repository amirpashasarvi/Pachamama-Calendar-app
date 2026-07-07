import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { useBookingSiteData } from '@/hooks/useBookingSiteData';
import { publishedPrograms, upcomingRunsForProgram, programFromPrice } from '@/lib/retreatLogic';

export default function RetreatsGridPage() {
  const { retreatTypes, retreatRuns, ready, error } = useBookingSiteData();

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

  const programs = publishedPrograms(retreatTypes, retreatRuns);

  return (
    <div className="min-h-screen bg-[#f5f5f0]">
      <header className="bg-white border-b border-gray-200 px-4 py-6">
        <div className="max-w-4xl mx-auto">
          <Link to="/" className="text-xs text-gray-400 hover:text-gray-600">← Home</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">Retreats</h1>
          <p className="text-sm text-gray-500 mt-1">Join us for a transformative stay at Pachamama</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-10">
        {programs.length === 0 ? (
          <p className="text-center text-sm text-gray-400 italic py-16">No retreats available to book right now.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            {programs.map(program => {
              const runs = upcomingRunsForProgram(program.id, retreatRuns);
              const nextRun = runs[0];
              const from = programFromPrice(program.id, retreatRuns);
              const photo = program.photoUrls?.[0];

              return (
                <Link
                  key={program.id}
                  to={`/retreats/${program.slug}`}
                  className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-md transition-shadow flex flex-col"
                >
                  <div className="h-44 bg-gray-100 shrink-0">
                    {photo && (
                      <img src={photo} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="p-5 flex-1 flex flex-col">
                    <h2 className="text-lg font-bold text-gray-900">{program.name}</h2>
                    {program.shortDescription && (
                      <p className="text-xs text-gray-600 mt-2 line-clamp-2">{program.shortDescription}</p>
                    )}
                    <div className="mt-auto pt-4 space-y-1">
                      {nextRun && (
                        <p className="text-xs text-gray-500">
                          Next: {format(parseISO(nextRun.startDate), 'dd MMM')} – {format(parseISO(nextRun.endDate), 'dd MMM yyyy')}
                        </p>
                      )}
                      {from !== null && (
                        <p className="text-sm font-bold text-gray-900">from €{from}</p>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
