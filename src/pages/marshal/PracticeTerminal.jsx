/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState } from 'react';
import api from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';
import { formatMs } from '../../utils/timeFormat';

export default function PracticeTerminal() {
  const role = useAuthStore((state) => state.role);
  const [mode, setMode] = useState(role === 'petugas_finish' ? 'finish' : 'start');
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState('');
  const [practices, setPractices] = useState([]);
  const [practiceId, setPracticeId] = useState('');
  const [entries, setEntries] = useState([]);
  const [runs, setRuns] = useState([]);
  const [number, setNumber] = useState('');
  const [clock, setClock] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => { api.get('/events/').then((res) => { const data=res.data.data||[];setEvents(data);setEventId(data[0]?.id||''); }); }, []);
  useEffect(() => { if (!eventId) return; api.get(`/practices/events/${eventId}`).then((res) => { const data=res.data.data||[];setPractices(data);setPracticeId(data.find((item)=>item.is_open)?.id||data[0]?.id||''); }); }, [eventId]);

  const refresh = async (id=practiceId) => {
    if (!id) { setEntries([]);setRuns([]);return; }
    const [entryRes,runRes]=await Promise.all([api.get(`/practices/${id}/entries`),api.get(`/practices/${id}/runs`)]);
    setEntries(entryRes.data.data||[]);setRuns(runRes.data.data||[]);
  };
  useEffect(() => { refresh(practiceId).catch(() => setMessage('Gagal memuat data Practice.')); }, [practiceId]);

  const selectedPractice=practices.find((item)=>item.id===practiceId);
  const entry=entries.find((item)=>String(item.practice_start_number)===String(number));
  const entryRuns=useMemo(()=>runs.filter((run)=>String(run.practice_start_number)===String(number)).sort((a,b)=>a.run_no-b.run_no),[runs,number]);
  const openRun=entryRuns.find((run)=>run.start_time&&!run.finish_time&&run.status==='OK');

  const useCurrentTime=()=>{const now=new Date();const p=(v)=>String(v).padStart(2,'0');setClock(`${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}.${p(Math.floor(now.getMilliseconds()/10))}`);};
  const submit=async(e)=>{e.preventDefault();if(!entry)return alert('Nomor Practice tidak terdaftar pada sesi ini.');if(!clock)return alert('Waktu wajib diisi.');try{const endpoint=mode==='start'?'/timekeeping/practice-runs/start':'/timekeeping/practice-runs/finish';const res=await api.post(endpoint,{practice_id:practiceId,practice_start_number:Number(number),time:clock});setMessage(res.data.message);setNumber('');setClock('');await refresh();}catch(err){setMessage(err.response?.data?.error||'Input Practice gagal.');}};

  return <div className="min-h-screen bg-gray-950 px-4 py-8 pb-20 text-white">
    <div className="mx-auto max-w-6xl space-y-6">
      <div><p className="text-xs font-black uppercase tracking-[.3em] text-red-500">Compactindo Timekeeping</p><h1 className="text-3xl font-black uppercase italic">Practice Terminal</h1></div>
      {(role==='admin'||role==='kamar_hitung')&&<div className="flex gap-2"><button onClick={()=>setMode('start')} className={`rounded px-5 py-2 font-black ${mode==='start'?'bg-red-600':'bg-gray-800'}`}>START</button><button onClick={()=>setMode('finish')} className={`rounded px-5 py-2 font-black ${mode==='finish'?'bg-red-600':'bg-gray-800'}`}>FINISH</button></div>}
      <div className="grid gap-4 rounded-xl border border-gray-800 bg-gray-900 p-5 md:grid-cols-2"><select className="rounded bg-gray-800 p-3" value={eventId} onChange={(e)=>setEventId(e.target.value)}>{events.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select><select className="rounded bg-gray-800 p-3" value={practiceId} onChange={(e)=>setPracticeId(e.target.value)}>{practices.map((item)=><option key={item.id} value={item.id}>{item.name} · {item.max_runs} run · {item.is_open?'OPEN':'CLOSE'}</option>)}</select></div>
      <form onSubmit={submit} className="grid gap-5 rounded-xl border border-gray-800 bg-gray-900 p-6 md:grid-cols-2">
        <div><label className="mb-2 block text-xs font-black uppercase text-gray-400">Nomor Practice</label><input autoFocus type="number" className="w-full rounded bg-black p-4 text-4xl font-black" value={number} onChange={(e)=>setNumber(e.target.value)}/></div>
        <div><label className="mb-2 block text-xs font-black uppercase text-gray-400">Waktu {mode}</label><div className="flex gap-2"><input className="min-w-0 flex-1 rounded bg-black p-4 text-2xl font-black" placeholder="HH:mm:ss.SS" value={clock} onChange={(e)=>setClock(e.target.value)}/><button type="button" onClick={useCurrentTime} className="rounded bg-gray-700 px-4 font-bold">NOW</button></div></div>
        <div className="md:col-span-2 rounded border border-gray-700 p-4">{entry?<><p className="text-xl font-black">Practice #{entry.practice_start_number} · Race #{entry.race_start_number}</p><p>{entry.driver_name} · {entry.vehicle_name}</p><p className="mt-2 text-sm text-gray-400">Run {entryRuns.length}/{selectedPractice?.max_runs||0}{openRun?` · Run ${openRun.run_no} menunggu finish`:''}</p></>:<p className="text-gray-500">Masukkan nomor Practice untuk melihat peserta.</p>}</div>
        <button disabled={!selectedPractice?.is_open} className="md:col-span-2 rounded bg-red-600 p-4 text-lg font-black uppercase disabled:bg-gray-700">Simpan {mode}</button>
      </form>
      {message&&<div className="rounded border border-red-800 bg-red-950 p-4 font-bold">{message}</div>}
      <div className="overflow-hidden rounded-xl border border-gray-800"><table className="w-full text-sm"><thead className="bg-gray-800"><tr><th className="p-3">Practice</th><th>Race</th><th className="text-left">Driver</th><th>Run</th><th>Start</th><th>Finish</th><th>Time</th></tr></thead><tbody>{runs.slice().reverse().map((run)=><tr key={run.id} className="border-t border-gray-800"><td className="p-3 text-center font-black">#{run.practice_start_number}</td><td className="text-center">#{run.race_start_number}</td><td>{run.driver_name}</td><td className="text-center">{run.run_no}</td><td className="text-center">{run.start_time||'-'}</td><td className="text-center">{run.finish_time||'-'}</td><td className="text-center font-black">{run.finish_time?formatMs(run.elapsed_time_ms):'OPEN'}</td></tr>)}</tbody></table></div>
    </div>
  </div>;
}
