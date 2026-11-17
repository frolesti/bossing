'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, Loader2, TrendingUp } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface PriceSeries {
  id: string;
  name: string;
  supermarket: string;
  warehouse: string;
  packageAmount: number;
  packageUnit: string;
  sourceUrl: string;
  storefrontUrl?: string;
  automaticCaptureEnabled?: boolean;
  points: { at: string; price: number; pricePerUnit: number }[];
}

interface BasicTracking {
  foods: { id: string; name: string; specification: string }[];
  chains: { chain: string; status: string; references: number; context: string | null; current: boolean;
    products: { foodId: string; productId: string; name: string; amount: number; unit: string }[];
    latest: null | { date: string; status: string; recorded: number; total: number;
      items: { foodId: string; state: string; message?: string }[] } }[];
  postalCode: string;
  current: boolean;
}

const money = new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR' });
const date = new Intl.DateTimeFormat('ca-ES', { day: 'numeric', month: 'short' });
const time = new Intl.DateTimeFormat('ca-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const contextLabel = (context: string) => context === 'public-catalog' ? 'Catàleg públic · Zona no confirmada' : `Zona ${context}`;

export default function HistoryPage() {
  const [days, setDays] = useState('90');
  const [series, setSeries] = useState<PriceSeries[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [query, setQuery] = useState('');
  const [metric, setMetric] = useState<'price' | 'pricePerUnit'>('price');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [revision, setRevision] = useState(0);
  const [tracking, setTracking] = useState<BasicTracking | null>(null);
  const [trackingError, setTrackingError] = useState(false);
  const [trackingChain, setTrackingChain] = useState('mercadona');

  useEffect(() => {
    const controller = new AbortController();
    setTrackingError(false);
    fetch('http://localhost:3001/api/history/tracking', { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Tracking unavailable');
        return response.json();
      }).then(data => { if (!controller.signal.aborted) setTracking(data); })
      .catch(() => { if (!controller.signal.aborted) setTrackingError(true); });
    return () => controller.abort();
  }, [revision]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`http://localhost:3001/api/history?${new URLSearchParams({ days })}`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('History unavailable');
        return response.json();
      }).then(data => {
        if (!controller.signal.aborted) { setSeries(data.series); setTruncated(data.truncated); }
      }).catch(() => {
        if (!controller.signal.aborted) setError('No es pot consultar l’històric de preus.');
      }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [days, revision]);

  const matches = series.filter(item => `${item.name} ${item.supermarket}`.toLocaleLowerCase('ca').includes(query.toLocaleLowerCase('ca')));
  const selected = matches.find(item => item.id === selectedId) || matches[0];
  const points = selected?.points.map(point => ({ ...point, time: new Date(point.at).getTime() })) || [];
  const first = points[0];
  const latest = points[points.length - 1];
  const change = first && latest ? Math.round((latest[metric] - first[metric]) * 100) / 100 : 0;
  const selectedChain = tracking?.chains.find(chain => chain.chain === trackingChain);

  return (
    <div className="app-page pb-24">
      <header className="page-header px-5 pt-4 pb-6 sm:px-10">
        <div className="border-b border-brand-600/25 pb-3 font-bold text-lg text-brand-600">bossing</div>
        <div className="flex items-center justify-between gap-3 pt-5">
          <h1 className="font-heading text-3xl text-brand-600">Evolució de preus</h1>
          <button type="button" title="Actualitzar històric" aria-label="Actualitzar històric" disabled={loading}
            onClick={() => setRevision(value => value + 1)} className="p-2 rounded-md hover:bg-surface-100 disabled:opacity-40">
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <p className="text-sm text-brand-700 mt-2">Catàleg en línia · Observacions verificades</p>
      </header>
      <main className="px-4 py-5 space-y-5">
        <section aria-label="Seguiment dels aliments bàsics" className="border-b border-surface-300 pb-4 space-y-3">
          <h2 className="text-xl">Cistella de bàsics</h2>
          {trackingError ? <p role="status" className="text-sm text-danger-500">No es pot consultar l’estat de les captures.</p>
            : !tracking ? <p role="status" className="text-sm text-ink-secondary">Carregant seguiment...</p>
            : <>
              <p className="text-sm text-ink-secondary">{tracking.foods.length} aliments · Captura diària a les 04:00 · Europe/Madrid</p>
              <label className="block text-xs text-ink-secondary">Supermercat
                <select value={trackingChain} onChange={event => setTrackingChain(event.target.value)} className="input mt-1 w-full text-sm capitalize">
                  {tracking.chains.filter(chain => chain.status === 'active').map(chain =>
                    <option key={chain.chain} value={chain.chain}>{chain.chain}</option>)}
                </select>
              </label>
              <p className="text-sm text-ink" aria-live="polite">
                {selectedChain?.latest ? `${selectedChain.latest.date} · ${selectedChain.latest.recorded}/${selectedChain.latest.total} preus enregistrats`
                  : 'Encara no s’ha executat cap captura.'}
                {selectedChain?.latest && !selectedChain.current && ' · Captura pendent o incompleta'}
              </p>
              {selectedChain?.context && <p className="text-xs text-ink-secondary">{contextLabel(selectedChain.context)}</p>}
              {selectedChain && selectedChain.references < tracking.foods.length && <p role="status" className="text-xs text-ink-secondary">
                {selectedChain.references} de {tracking.foods.length} aliments amb referència validada
              </p>}
              <details>
                <summary className="cursor-pointer text-sm text-brand-600">Aliments i formats</summary>
                <ul className="divide-y divide-surface-200 mt-2">{tracking.foods.map(food => {
                  const item = selectedChain?.latest?.items.find(candidate => candidate.foodId === food.id);
                  const reference = selectedChain?.products.find(candidate => candidate.foodId === food.id);
                  const state = !reference ? 'Sense referència validada' : item?.state === 'recorded' ? 'Enregistrat' : item?.state === 'unavailable' ? 'Sense estoc'
                    : item?.state === 'error' ? 'Error de captura' : 'Pendent';
                  return <li key={food.id} className="py-2 flex items-start justify-between gap-3 text-sm">
                    <span className="min-w-0"><span className="block font-semibold">{food.name}</span>
                      <span className="block text-xs text-ink-secondary break-words">{reference
                        ? `${reference.name} · ${reference.amount} ${reference.unit}` : food.specification}</span>
                      {item?.message && <span className="block text-xs text-danger-500 break-words">{item.message}</span>}
                    </span><span className="shrink-0 max-w-[40%] text-right text-xs text-ink-secondary">{state}</span>
                  </li>;
                })}</ul>
              </details>
              <details>
                <summary className="cursor-pointer text-sm text-brand-600">Cobertura per supermercat</summary>
                <ul className="mt-2 space-y-2">{tracking.chains.map(chain => <li key={chain.chain} className="flex justify-between gap-3 text-xs">
                  <span className="capitalize">{chain.chain}</span><span className="text-ink-secondary">
                    {chain.status === 'active' ? `${chain.latest?.recorded || 0}/${chain.references} preus${chain.current ? ' · Al dia' : ' · Pendent'}` : 'Captura automàtica pendent de validar'}
                  </span>
                </li>)}</ul>
              </details>
            </>}
        </section>
        <fieldset className="flex flex-wrap gap-4 text-sm">
          <legend className="text-xs text-ink-secondary mb-2">Període</legend>
          {[['30', '30 dies'], ['90', '90 dies'], ['365', '1 any']].map(([value, label]) => (
            <label key={value} className="flex items-center gap-2">
              <input type="radio" name="period" value={value} checked={days === value}
                onChange={() => setDays(value)} className="accent-brand-600" />{label}
            </label>
          ))}
        </fieldset>
        {loading ? <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="w-4 h-4 animate-spin" />Carregant observacions...</p>
          : error ? <p role="alert" className="text-sm text-danger-500">{error}</p>
          : !series.length ? <div role="status" className="border-y border-surface-300 py-10 text-center space-y-3">
            <TrendingUp className="w-8 h-8 mx-auto text-ink-muted" />
            <p className="text-sm text-ink-secondary">Encara no hi ha observacions verificades en aquest període.</p>
          </div> : <>
            {truncated && <p role="status" className="text-sm text-ink-secondary">Resultat limitat a les 5.000 observacions més recents.</p>}
            <label className="block text-xs text-ink-secondary">Filtrar productes
              <input type="search" value={query} onChange={event => setQuery(event.target.value)} className="input mt-1 w-full" />
            </label>
            {matches.length ? <label className="block text-xs text-ink-secondary">Producte, cadena i zona
              <select value={selected.id} onChange={event => setSelectedId(event.target.value)} className="input mt-1 w-full min-w-0 text-sm">
                {matches.map(item => <option key={item.id} value={item.id}>
                  {item.name} · {item.supermarket} · {item.packageAmount} {item.packageUnit} · {contextLabel(item.warehouse)}
                </option>)}
              </select>
            </label> : <p role="status" className="text-sm text-ink-secondary">Cap producte coincideix amb la cerca.</p>}
            {selected && first && latest && <>
              <fieldset className="flex flex-wrap gap-4 text-sm">
                <legend className="sr-only">Mesura del preu</legend>
                <label className="flex items-center gap-2"><input type="radio" name="metric" checked={metric === 'price'}
                  onChange={() => setMetric('price')} className="accent-brand-600" />Envàs</label>
                <label className="flex items-center gap-2"><input type="radio" name="metric" checked={metric === 'pricePerUnit'}
                  onChange={() => setMetric('pricePerUnit')} className="accent-brand-600" />€/{selected.packageUnit}</label>
              </fieldset>
              <dl className="grid grid-cols-2 gap-4 border-y border-surface-300 py-4">
                <div><dt className="text-xs text-ink-secondary">Últim preu</dt><dd className="text-2xl text-ink">{money.format(latest[metric])}</dd></div>
                <div><dt className="text-xs text-ink-secondary">Variació del període</dt><dd className="text-2xl text-ink">
                  {points.length < 2 ? 'Sense variació calculable' : `${change > 0 ? '+' : ''}${money.format(change)}`}
                </dd></div>
              </dl>
              <figure aria-label={`Històric de ${selected.name}, ${selected.supermarket}, ${contextLabel(selected.warehouse)}`}>
                <div className="h-72 w-full min-w-0 overflow-hidden">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={points} margin={{ top: 16, right: 12, bottom: 8, left: 0 }} accessibilityLayer>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d6cbb7" />
                      <XAxis dataKey="time" type="number" scale="time" domain={['dataMin', 'dataMax']}
                        tickFormatter={value => latest.time - first.time < 86_400_000 ? time.format(value) : date.format(value)} minTickGap={45} tick={{ fontSize: 11 }} />
                      <YAxis width={58} tickFormatter={value => money.format(value)} tick={{ fontSize: 11 }} domain={[0, 'auto']} />
                      <Tooltip labelFormatter={value => new Date(Number(value)).toLocaleString('ca-ES')}
                        formatter={value => [money.format(Number(value)), metric === 'price' ? 'Envàs' : `€/${selected.packageUnit}`]} />
                      <Line type="linear" dataKey={metric} stroke="#198465" strokeWidth={2} dot={{ r: 4 }} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <figcaption className="text-xs text-ink-secondary break-words">
                  {selected.supermarket} · {selected.packageAmount} {selected.packageUnit} · {contextLabel(selected.warehouse)} · {points.length} observacions
                </figcaption>
              </figure>
              {selected.automaticCaptureEnabled === false && <p role="status" className="text-xs text-ink-secondary">
                Lectura assistida · Captura automàtica pendent de validar
              </p>}
              <section aria-label="Últimes observacions" className="border-t border-surface-300 pt-4">
                <h2 className="text-lg mb-2">Últimes observacions</h2>
                <ul className="divide-y divide-surface-200">{points.slice(-10).reverse().map(point => (
                  <li key={point.at} className="flex justify-between gap-3 py-2 text-sm">
                    <time dateTime={point.at}>{new Date(point.at).toLocaleString('ca-ES')}</time><span className="shrink-0">{money.format(point[metric])}</span>
                  </li>
                ))}</ul>
                <a href={selected.storefrontUrl || selected.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 underline">Font: {selected.supermarket}</a>
              </section>
            </>}
          </>}
      </main>
    </div>
  );
}