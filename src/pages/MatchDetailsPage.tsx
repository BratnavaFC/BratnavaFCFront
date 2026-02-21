import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Section } from '../components/Section';
import { MatchesApi } from '../api/endpoints';

export default function MatchDetailsPage(){
  const { matchId } = useParams();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    (async () => {
      if (!matchId) return;
      const res = await MatchesApi.details(matchId);
      setData(res.data);
    })();
  }, [matchId]);

  return (
    <div className="space-y-6">
      <Section title="Detalhes da partida">
        {!data ? <div className="muted">Carregando...</div> : (
          <pre className="text-xs bg-slate-900 text-slate-50 rounded-xl p-4 overflow-auto">
{JSON.stringify(data, null, 2)}
          </pre>
        )}
      </Section>
    </div>
  );
}
