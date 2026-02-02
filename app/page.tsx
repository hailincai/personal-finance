'use client';
import { useState, useEffect } from 'react';
import { db, runMigration } from '../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { createClient } from '@supabase/supabase-js';
import { Wallet, Tag, Calendar, ChevronRight, PieChart as PieIcon, Plus, RefreshCw, X, CloudUpload, Zap, DownloadCloud, Settings2 } from 'lucide-react';

export default function Home() {
  const [showSync, setShowSync] = useState(false);
  const [sbUrl, setSbUrl] = useState(process.env.NEXT_PUBLIC_SUPABASE_URL || '');
  const [sbKey, setSbKey] = useState(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '');
  const [isSyncing, setIsSyncing] = useState(false);
  
  useEffect(() => { 
    runMigration();
    // 只有在环境变量没值的情况下，才去读取 localStorage 兜底
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const savedUrl = localStorage.getItem('sb_url');
      const savedKey = localStorage.getItem('sb_key');
      if (savedUrl) setSbUrl(savedUrl);
      if (savedKey) setSbKey(savedKey);
    }
  }, []);

  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const categories = useLiveQuery(() => db.categories.toArray()) || [];
  const allTxs = useLiveQuery(() => db.transactions.toArray()) || [];
  const autos = useLiveQuery(() => db.autoTemplates.toArray()) || [];

  const getClient = () => {
    // 优先级：环境变量 > 手动输入 > LocalStorage
    const finalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || sbUrl;
    const finalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || sbKey;
    if (!finalUrl || !finalKey) throw new Error('未配置 Supabase 信息');
    
    // 成功后顺便存一下 local，下次手动用也方便
    localStorage.setItem('sb_url', finalUrl);
    localStorage.setItem('sb_key', finalKey);
    
    return createClient(finalUrl, finalKey);
  };

  const pushToCloud = async () => {
    setIsSyncing(true);
    try {
      const supabase = getClient();
      if(accounts.length) await supabase.from('accounts').upsert(accounts);
      if(categories.length) await supabase.from('categories').upsert(categories);
      if(allTxs.length) {
        await supabase.from('transactions').upsert(allTxs.map(t => ({
          id: t.id, amount: t.amount, description: t.description, date: t.date, account_id: t.accountId, category: t.category
        })));
      }
      if(autos.length) {
        await supabase.from('auto_templates').upsert(autos.map(a => ({
          id: a.id, amount: a.amount, description: a.description, day_of_month: a.dayOfMonth, account_id: a.accountId, category: a.category
        })));
      }
      alert('✅ 推送成功！');
    } catch (e: any) { alert('推送失败: ' + e.message); }
    finally { setIsSyncing(false); }
  };

  const pullFromCloud = async () => {
    setIsSyncing(true);
    try {
      const supabase = getClient();
      const { data: accs } = await supabase.from('accounts').select('*');
      const { data: cats } = await supabase.from('categories').select('*');
      const { data: txs } = await supabase.from('transactions').select('*');
      const { data: auts } = await supabase.from('auto_templates').select('*');

      await db.transaction('rw', [db.accounts, db.categories, db.transactions, db.autoTemplates], async () => {
        if(accs) { await db.accounts.clear(); await db.accounts.bulkAdd(accs); }
        if(cats) { await db.categories.clear(); await db.categories.bulkAdd(cats); }
        if(txs) {
          await db.transactions.clear();
          await db.transactions.bulkAdd(txs.map(t => ({ id: t.id, amount: t.amount, description: t.description, date: t.date, accountId: t.account_id, category: t.category })));
        }
        if(auts) {
          await db.autoTemplates.clear();
          await db.autoTemplates.bulkAdd(auts.map(a => ({ id: a.id, amount: a.amount, description: a.description, dayOfMonth: a.day_of_month, accountId: a.account_id, category: a.category })));
        }
      });
      alert('📥 拉取成功！');
    } catch (e: any) { alert('拉取失败: ' + e.message); }
    finally { setIsSyncing(false); }
  };

  const isEnvReady = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen pb-12 shadow-2xl relative overflow-hidden">
      <div className="bg-slate-900 p-8 text-white rounded-b-[3rem] shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl font-black italic tracking-tighter">财务管理</h1>
          <button onClick={() => setShowSync(true)} className="p-2 bg-blue-600 rounded-2xl shadow-lg active:scale-95 transition-all relative">
            <RefreshCw size={18}/>
            {isEnvReady && <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 border-2 border-slate-900 rounded-full"></div>}
          </button>
        </div>
        <div className="flex flex-col gap-3">
          {accounts.map(a => (
            <div key={a.id} className="flex justify-between items-center bg-white/10 p-4 rounded-2xl border border-white/5">
              <span className="text-[11px] font-bold opacity-60 uppercase">{a.name}</span>
              <span className="font-mono font-bold text-lg text-blue-400">¥{a.balance.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      {showSync && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-[360px] rounded-[2.5rem] p-8 animate-in zoom-in-95 duration-200 shadow-2xl relative text-center">
            <button onClick={()=>setShowSync(false)} className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full text-slate-400"><X size={16}/></button>
            <div className="mb-6">
              <h2 className="text-xl font-black mb-1">云端同步</h2>
              <p className="text-[10px] text-blue-500 font-bold uppercase tracking-widest italic">
                {isEnvReady ? '⚡ Environment Ready' : '⚙️ Manual Config Mode'}
              </p>
            </div>
            
            {!isEnvReady && (
              <div className="space-y-4 mb-8">
                <input value={sbUrl} onChange={e=>setSbUrl(e.target.value)} placeholder="Supabase URL" className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-400 outline-none rounded-2xl text-[10px] font-mono" />
                <input value={sbKey} type="password" onChange={e=>setSbKey(e.target.value)} placeholder="Supabase Anon Key" className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-400 outline-none rounded-2xl text-[10px] font-mono" />
              </div>
            )}

            {isEnvReady && (
              <div className="mb-8 p-4 bg-green-50 rounded-2xl border border-green-100 flex items-center gap-3">
                <div className="p-2 bg-green-500 text-white rounded-lg"><Settings2 size={16}/></div>
                <div className="text-left"><p className="text-[11px] font-black text-green-700">环境变量已启用</p><p className="text-[9px] text-green-600 opacity-70">无需手动输入，配置已锁定</p></div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <button onClick={pushToCloud} disabled={isSyncing} className="py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase flex flex-col items-center gap-2 active:scale-95 transition-all">
                <CloudUpload size={18}/> 推送
              </button>
              <button onClick={pullFromCloud} disabled={isSyncing} className="py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase flex flex-col items-center gap-2 active:scale-95 transition-all">
                <DownloadCloud size={18}/> 拉取
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="p-6">
        <div className="space-y-4">
          {allTxs.slice(-10).reverse().map(t => (
            <div key={t.id} className="flex justify-between items-center px-1">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400"><Zap size={18}/></div>
                <div><p className="font-bold text-sm">{t.description}</p><p className="text-[10px] text-slate-400 font-bold uppercase">{t.date}</p></div>
              </div>
              <span className={`font-mono font-bold text-sm ${t.amount < 0 ? 'text-rose-500':'text-emerald-600'}`}>{t.amount.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}