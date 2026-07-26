import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import api, { assetUrl } from '../../services/api';
import { formatClockCentiseconds, formatMs } from '../../utils/timeFormat';

export default function Timecard() {
  const { eventId, participantId } = useParams();
  const [timecard, setTimecard] = useState(null);
  const [isLoading, setIsLoading] = useState(Boolean(participantId));
  const [error, setError] = useState('');

  useEffect(() => {
    if (eventId && participantId) fetchTimecard(participantId);
    else {
      setTimecard(null);
      setError('Link timecard tidak valid.');
      setIsLoading(false);
    }
  }, [eventId, participantId]);

  const fetchTimecard = async (nextParticipantId) => {
    if (!eventId || !nextParticipantId) return;
    setIsLoading(true);
    setError('');
    try {
      const res = await api.get(`/public/timecards/${eventId}/${nextParticipantId}`);
      setTimecard(res.data.data);
    } catch (err) {
      setTimecard(null);
      setError(err.response?.data?.error || 'Timecard tidak ditemukan.');
    } finally {
      setIsLoading(false);
    }
  };

  const totalPenalty = useMemo(() => timecard?.penalty_time_ms || 0, [timecard]);
  const progressPercent = useMemo(() => {
    if (!timecard?.total_ss_count) return 0;
    return Math.round((timecard.completed_ss_count / timecard.total_ss_count) * 100);
  }, [timecard]);
  const timeDecimalPlaces = timecard?.event?.time_decimal_places ?? 2;

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="mx-auto max-w-6xl px-3 py-4 sm:px-6 lg:px-8">
        {isLoading ? (
          <StateMessage text="Memuat timecard..." />
        ) : error ? (
          <StateMessage tone="danger" text={error} />
        ) : timecard ? (
          <>
            <header className="mb-4 rounded-lg border border-white/10 bg-neutral-900 p-4 shadow-xl sm:p-5">
              <div className="flex items-center gap-3">
                {timecard.event.logo_url && (
                  <img src={assetUrl(timecard.event.logo_url)} alt="Logo event" className="h-14 w-20 shrink-0 object-contain sm:h-16 sm:w-24" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-red-400">Online Timecard</p>
                  <h1 className="break-words text-lg font-black uppercase leading-tight tracking-wide sm:text-2xl">{timecard.event.name}</h1>
                  <p className="mt-1 text-xs font-semibold text-gray-300 sm:text-sm">{formatEventDate(timecard.event)}</p>
                  <p className="text-xs font-semibold text-gray-400 sm:text-sm">{timecard.event.location || '-'}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black px-3 py-2 text-center">
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">No Start</p>
                  <p className="text-3xl font-black leading-none sm:text-4xl">{timecard.participant.start_number}</p>
                </div>
              </div>
            </header>

            <section className="mb-4 rounded-lg bg-white p-4 text-gray-950 shadow-xl sm:p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Driver / Co-driver</p>
                  <h2 className="mt-1 break-words text-2xl font-black leading-tight">{timecard.participant.driver_name}</h2>
                  <p className="mt-1 text-sm font-bold text-gray-500">{timecard.participant.codriver_name || '-'}</p>
                </div>
                <span className={`shrink-0 rounded px-2.5 py-1 text-[10px] font-black uppercase ${statusClass(timecard.status)}`}>
                  {timecard.status}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Info label="Entrant" value={timecard.participant.entrant_name || timecard.participant.team_name || '-'} />
                <Info label="Class" value={timecard.participant.class_name} />
                <Info label="Group" value={timecard.participant.group_name} />
                <Info label="Regional" value={timecard.participant.regional_name || '-'} />
                <Info label="Kategori" value={timecard.participant.category_name} />
                <Info label="Usia" value={timecard.participant.age ? `${timecard.participant.age} tahun` : '-'} />
              </div>
            </section>

            <section className="mb-4 grid gap-3 sm:grid-cols-3">
              <Summary label="SS Selesai" value={`${timecard.completed_ss_count}/${timecard.total_ss_count}`} />
              <Summary label="Total Penalti" value={formatMs(totalPenalty, timeDecimalPlaces)} />
              <Summary label="Total Waktu" value={formatMs(timecard.total_time_ms, timeDecimalPlaces)} highlight />
            </section>

            <section className="mb-5 rounded-lg border border-white/10 bg-neutral-900 p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-xs font-black uppercase tracking-widest text-gray-400">Progress SS</p>
                <p className="font-mono text-sm font-black text-white">{progressPercent}%</p>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-neutral-800">
                <div className="h-full rounded-full bg-red-600 transition-all" style={{ width: `${progressPercent}%` }} />
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-black uppercase tracking-wide">Rincian Stage</h2>
                <span className="text-xs font-bold text-gray-400">{timecard.total_ss_count} SS resmi</span>
              </div>

              <div className="space-y-3 lg:hidden">
                {timecard.stages.map((stage) => (
                  <StageCard key={stage.record_id || stage.ss_id} stage={stage} timeDecimalPlaces={timeDecimalPlaces} />
                ))}
              </div>

              <div className="hidden overflow-hidden rounded-lg bg-white text-gray-900 shadow-xl lg:block">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-gray-100 text-left text-xs uppercase tracking-wide text-gray-600">
                        <th className="p-3">SS</th>
                        <th className="p-3 text-center">Target TC</th>
                        <th className="p-3 text-center">TC</th>
                        <th className="p-3 text-center">Status TC</th>
                        <th className="p-3 text-center">Start</th>
                        <th className="p-3 text-center">Finish</th>
                        <th className="p-3 text-right">Time</th>
                        <th className="p-3 text-right">Penalty</th>
                        <th className="p-3 text-right">Total</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {timecard.stages.map((stage) => (
                        <tr key={stage.record_id || stage.ss_id} className="border-t border-gray-200">
                          <td className="p-3">
                            <div className="font-black">{stageLabel(stage)}</div>
                            <div className="text-xs font-semibold text-gray-500">{stage.ss_name}</div>
                          </td>
                          <td className="p-3 text-center font-mono">{shortClock(stage.target_tc_time)}</td>
                          <td className="p-3 text-center font-mono">{shortClock(stage.tc_time)}</td>
                          <td className="p-3 text-center">
                            <TCBadge status={stage.tc_status} />
                            {(stage.tc_status === 'EARLY' || stage.tc_status === 'LATE') && (
                              <div className="mt-1 text-[11px] font-bold text-gray-500">{formatTCDelta(stage.tc_delta_ms)}</div>
                            )}
                          </td>
                          <td className="p-3 text-center font-mono">{stage.start_time || '-'}</td>
                          <td className="p-3 text-center font-mono">{formatClockCentiseconds(stage.finish_time, timeDecimalPlaces)}</td>
                          <td className="p-3 text-right font-mono">{formatMs(stage.elapsed_time_ms, timeDecimalPlaces)}</td>
                          <td className="p-3 text-right font-mono">{formatMs(stage.penalty_time_ms, timeDecimalPlaces)}</td>
                          <td className="p-3 text-right font-mono font-black">{formatMs(stage.total_time_ms, timeDecimalPlaces)}</td>
                          <td className="p-3">
                            <div className="font-black">{stage.status || '-'}</div>
                            {stage.remark_penalty && <div className="text-xs text-red-600">{stage.remark_penalty}</div>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </>
        ) : (
          <StateMessage text="Link timecard tidak valid." />
        )}
      </div>
    </div>
  );
}

function StateMessage({ text, tone = 'neutral' }) {
  const toneClass = tone === 'danger'
    ? 'border-red-900 bg-red-950/40 text-red-100'
    : 'border-white/10 bg-white/5 text-gray-300';

  return <div className={`rounded-lg border p-10 text-center font-bold ${toneClass}`}>{text}</div>;
}

function Info({ label, value }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">{label}</p>
      <p className="mt-1 break-words text-sm font-black text-gray-950">{value || '-'}</p>
    </div>
  );
}

function Summary({ label, value, highlight = false }) {
  return (
    <div className={`rounded-lg border p-4 ${highlight ? 'border-red-500 bg-red-600 text-white' : 'border-white/10 bg-white/10 text-white'}`}>
      <p className={`text-[10px] font-black uppercase tracking-widest ${highlight ? 'text-red-100' : 'text-gray-400'}`}>{label}</p>
      <p className="mt-2 break-words font-mono text-2xl font-black">{value}</p>
    </div>
  );
}

function StageCard({ stage, timeDecimalPlaces = 2 }) {
  return (
    <article className="rounded-lg bg-white p-4 text-gray-950 shadow-xl">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">{stage.is_shakedown ? 'Shakedown' : 'Special Stage'}</p>
          <h3 className="text-xl font-black">{stageLabel(stage)}</h3>
          <p className="text-sm font-bold text-gray-500">{stage.ss_name}</p>
        </div>
        <span className={`rounded px-2.5 py-1 text-[10px] font-black uppercase ${stageStatusClass(stage.status)}`}>
          {stage.status || 'Belum Start'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <MiniMetric label="Target TC" value={shortClock(stage.target_tc_time)} />
        <MiniMetric label="TC" value={shortClock(stage.tc_time)} />
        <MiniMetric label="Start" value={stage.start_time || '-'} />
        <MiniMetric label="Finish" value={formatClockCentiseconds(stage.finish_time, timeDecimalPlaces)} />
      </div>

      <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Status TC</span>
          <TCBadge status={stage.tc_status} />
        </div>
        {(stage.tc_status === 'EARLY' || stage.tc_status === 'LATE') && (
          <p className="text-xs font-bold text-gray-600">{formatTCDelta(stage.tc_delta_ms)}</p>
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <MiniMetric label="Time" value={formatMs(stage.elapsed_time_ms, timeDecimalPlaces)} />
        <MiniMetric label="Penalty" value={formatMs(stage.penalty_time_ms, timeDecimalPlaces)} />
        <MiniMetric label="Total" value={formatMs(stage.total_time_ms, timeDecimalPlaces)} strong />
      </div>

      {stage.remark_penalty && (
        <div className="mt-3 rounded-lg bg-red-50 p-3 text-xs font-bold text-red-700">{stage.remark_penalty}</div>
      )}
    </article>
  );
}

function MiniMetric({ label, value, strong = false }) {
  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">{label}</p>
      <p className={`mt-1 break-words font-mono text-sm ${strong ? 'font-black text-red-700' : 'font-bold text-gray-950'}`}>{value || '-'}</p>
    </div>
  );
}

function stageLabel(stage) {
  if (stage?.is_shakedown) return stage.attempt_no ? `Shakedown ${stage.attempt_no}` : 'Shakedown';
  return `SS ${stage.ss_order}`;
}

function TCBadge({ status }) {
  return (
    <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${tcStatusClass(status)}`}>
      {tcStatusLabel(status)}
    </span>
  );
}

function formatEventDate(event) {
  const formatDate = (value) => {
    if (!value) return '';
    return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(value));
  };
  const start = formatDate(event.start_date);
  const end = formatDate(event.end_date);
  if (!end || end === start) return start;
  return `${start} - ${end}`;
}

function shortClock(value) {
  if (!value) return '-';
  return value.slice(0, 5);
}

function formatTCDelta(ms) {
  const value = Number(ms);
  if (!Number.isFinite(value) || value === 0) return '';
  const absMs = Math.abs(value);
  const minutes = Math.floor(absMs / 60000);
  const seconds = Math.floor((absMs % 60000) / 1000);
  const direction = value < 0 ? 'lebih awal' : 'terlambat';
  return `${minutes}m ${seconds}s ${direction}`;
}

function statusClass(status) {
  if (status === 'OK') return 'bg-green-100 text-green-700';
  if (status === 'INCOMPLETE') return 'bg-yellow-100 text-yellow-700';
  if (status === 'BWTM') return 'bg-purple-100 text-purple-700';
  if (status === 'DNF') return 'bg-orange-100 text-orange-700';
  if (status === 'DSQ') return 'bg-red-100 text-red-700';
  return 'bg-gray-100 text-gray-700';
}

function stageStatusClass(status) {
  if (status === 'OK') return 'bg-green-100 text-green-700';
  if (status === 'BWTM') return 'bg-purple-100 text-purple-700';
  if (status === 'DNF') return 'bg-orange-100 text-orange-700';
  if (status === 'DSQ') return 'bg-red-100 text-red-700';
  return 'bg-gray-100 text-gray-700';
}

function tcStatusLabel(status) {
  const labels = {
    ON_TIME: 'Sesuai',
    EARLY: 'Terlalu Awal',
    LATE: 'Terlambat',
    WAITING: 'Menunggu',
    UNSCHEDULED: 'Tanpa Target',
    NOT_SCHEDULED: 'Belum Ada',
    INVALID: 'Invalid',
  };
  return labels[status] || '-';
}

function tcStatusClass(status) {
  if (status === 'ON_TIME') return 'bg-green-100 text-green-700';
  if (status === 'EARLY' || status === 'LATE') return 'bg-yellow-100 text-yellow-700';
  if (status === 'INVALID') return 'bg-red-100 text-red-700';
  return 'bg-gray-100 text-gray-600';
}
