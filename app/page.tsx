'use client';
import { useState, useEffect } from 'react';
import { db, runMigration } from '../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { createClient } from '@supabase/supabase-js';
import { Wallet, Tag, Calendar, ChevronRight, PieChart as PieIcon, Plus, RefreshCw, X, CloudUpload, Zap } from 'lucide-react';

export default function Home() {
  const [showSync, setShowSync] = useState(false);
  const [sbUrl, setSbUrl] = useState('');
  const [sbKey, setSbKey] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  
  useEffect(() => { runMigration(); }, []);

  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const categories = useLiveQuery(() => db.categories.toArray()) || [];
  const allTxs = useLiveQuery(() => db.transactions.toArray()) || [];
  const autos = useLiveQuery(() => db.autoTemplates.toArray()) || [];

  const pushToCloud = async () => {
    if (!sbUrl || !sbKey) return alert('请输入 Supabase 配置');
    setIsSyncing(true);
    const supabase = createClient(sbUrl, sbKey);
    try {
      // 1. 同步账号
      if(accounts.length) await supabase.from('accounts').upsert(accounts);
      // 2. 同步分类
      if(categories.length) await supabase.from('categories').upsert(categories);
      // 3. 同步交易 (映射 account_id)
      if(allTxs.length) {
        const txMapped = allTxs.map(t => ({
          id: t.id, amount: t.amount, description: t.description,
          date: t.date, account_id: t.accountId, category: t.category
        }));
        await supabase.from('transactions').upsert(txMapped);
      }
      // 4. 同步自动模板 (映射 account_id)
      if(autos.length) {
        const autoMapped = autos.map(a => ({
          id: a.id, amount: a.amount, description: a.description,
          day_of_month: a.dayOfMonth, account_id: a.accountId, category: a.category
        }));
        await supabase.from('auto_templates').upsert(autoMapped);
      }
      alert('✅ 四表全量云端同步成功！');
    } catch (e: any) { alert('同步失败: ' + e.message); }
    finally { setIsSyncing(false); }
  };

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen pb-12 shadow-2xl relative overflow-hidden">
      <div className="bg-slate-900 p-8 text-white rounded-b-[3rem] shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl font-black italic tracking-tighter">财务管理</h1>
          <button onClick={() => setShowSync(true)} className="p-2 bg-blue-600 rounded-2xl shadow-lg active:scale-95 transition-all"><RefreshCw size={18}/></button>
        </div>
        <div className="flex flex-col gap-3">
          {accounts.map(a => (
            <div key={a.id} className="flex justify-between items-center bg-white/10 p-4 rounded-2xl border border-white/5 shadow-inner">
              <span className="text-[11px] font-bold opacity-60 uppercase tracking-tighter">{a.name}</span>
              <span className="font-mono font-bold text-lg text-blue-400">¥{a.balance.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      {showSync && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-[360px] rounded-[2.5rem] p-8 animate-in zoom-in-95 duration-200 shadow-2xl relative text-center">
            <button onClick={()=>setShowSync(false)} className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full text-slate-400"><X size={16}/></button>
            <h2 className="text-xl font-black mb-1">云端同步</h2>
            <p className="text-[10px] text-blue-500 font-bold uppercase tracking-widest mb-8 italic">Full Table UUID Mapping</p>
            <div className="space-y-4 mb-8 text-left">
              <input value={sbUrl} onChange={e=>setSbUrl(e.target.value)} placeholder="Supabase URL" className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-400 outline-none rounded-2xl text-[10px] font-mono" />
              <input value={sbKey} onChange={e=>setSbKey(e.target.value)} placeholder="Supabase Anon Key" className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-400 outline-none rounded-2xl text-[10px] font-mono" />
            </div>
            <button onClick={pushToCloud} disabled={isSyncing} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-xs shadow-xl flex items-center justify-center gap-3">
              {isSyncing ? <RefreshCw className="animate-spin" size={16}/> : <><CloudUpload size={18}/> 推送全量数据</>}
            </button>
          </div>
        </div>
      )}

      <div className="p-6">
        <div className="grid grid-cols-4 gap-3 mb-8 text-center">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl flex flex-col items-center gap-2 border border-blue-100"><Wallet size={20}/><span className="text-[9px] font-black uppercase">账号</span></div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl flex flex-col items-center gap-2 border border-rose-100"><Plus size={20}/><span className="text-[9px] font-black uppercase">记账</span></div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl flex flex-col items-center gap-2 border border-indigo-100"><Tag size={20}/><span className="text-[9px] font-black uppercase">分类</span></div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl flex flex-col items-center gap-2 border border-amber-100"><Calendar size={20}/><span className="text-[9px] font-black uppercase">固定</span></div>
        </div>
        <div className="w-full mb-8 p-6 bg-slate-800 text-white rounded-[2.5rem] flex items-center justify-between shadow-2xl">
          <div className="flex items-center gap-4"><div className="p-3 bg-white/10 rounded-2xl"><PieIcon size={24}/></div><p className="text-sm font-black uppercase">报表分析</p></div>
          <ChevronRight size={20} className="opacity-30"/>
        </div>
        <div className="space-y-4">
          {allTxs.slice(-5).reverse().map(t => (
            <div key={t.id} className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400"><Zap size={18}/></div>
                <div><p className="font-bold text-sm">{t.description}</p><p className="text-[10px] text-slate-400 font-bold uppercase">{t.date} · {t.category}</p></div>
              </div>
              <span className={`font-mono font-bold text-sm ${t.amount < 0 ? 'text-rose-500':'text-emerald-600'}`}>{t.amount.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}