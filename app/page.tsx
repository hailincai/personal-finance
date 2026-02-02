'use client';
import { useState, useMemo, useEffect } from 'react';
import { db, runMigration } from '../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Wallet, Tag, Calendar, ArrowLeft, Zap, ChevronLeft, ChevronRight, PieChart as PieIcon, Plus, Download, Upload, RefreshCw, X } from 'lucide-react';

export default function Home() {
  const [view, setView] = useState('LIST');
  const [showSync, setShowSync] = useState(false);
  const [syncData, setSyncData] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    runMigration();
  }, []);

  const monthStr = useMemo(() => {
    const y = currentDate.getFullYear();
    const m = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    return `${y}-${m}`;
  }, [currentDate]);

  const accounts = useLiveQuery(() => db.accounts.toArray());
  const allTxs = useLiveQuery(() => db.transactions.toArray());
  const monthlyTxs = useMemo(() => allTxs?.filter(t => t.date.startsWith(monthStr)) || [], [allTxs, monthStr]);

  const handleExport = async () => {
    const data = {
      accounts: await db.accounts.toArray(),
      categories: await db.categories.toArray(),
      transactions: await db.transactions.toArray(),
      autoTemplates: await db.autoTemplates.toArray()
    };
    setSyncData(btoa(encodeURIComponent(JSON.stringify(data))));
    alert('✅ 数据已导出！请复制下方文本框内的代码。');
  };

  const handleImport = async () => {
    if(!syncData) return alert('请先粘贴备份代码');
    try {
      const decoded = JSON.parse(decodeURIComponent(atob(syncData)));
      await db.transaction('rw', [db.accounts, db.categories, db.transactions, db.autoTemplates], async () => {
        await db.accounts.clear(); await db.categories.clear();
        await db.transactions.clear(); await db.autoTemplates.clear();
        await db.accounts.bulkAdd(decoded.accounts);
        await db.categories.bulkAdd(decoded.categories);
        await db.transactions.bulkAdd(decoded.transactions);
        await db.autoTemplates.bulkAdd(decoded.autoTemplates);
      });
      alert('🚀 导入成功！');
      window.location.reload();
    } catch (e) { alert('❌ 导入失败'); }
  };

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen pb-12 shadow-2xl font-sans text-slate-900">
      <div className="bg-slate-900 p-8 text-white rounded-b-[3rem] shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl font-black">财务管理</h1>
          <button onClick={() => setShowSync(true)} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 rounded-full text-[10px] font-black hover:bg-blue-500 transition-all shadow-lg">
            <RefreshCw size={12}/> 数据搬家
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {accounts?.map(a => (
            <div key={a.id} className="flex justify-between items-center bg-white/10 p-4 rounded-2xl border border-white/5 shadow-inner">
              <span className="text-[11px] font-bold opacity-60 uppercase tracking-tighter">{a.name}</span>
              <span className="font-mono font-bold text-lg text-blue-400">¥{a.balance.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      {showSync && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center">
          <div className="bg-white w-full max-w-md rounded-t-[3rem] p-8 animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center mb-6">
               <h2 className="text-lg font-black italic">数据搬家</h2>
               <button onClick={()=>setShowSync(false)} className="p-2 bg-slate-100 rounded-full"><X size={20}/></button>
            </div>
            <textarea value={syncData} onChange={(e)=>setSyncData(e.target.value)} className="w-full h-32 bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-[10px] font-mono mb-6 outline-none focus:border-blue-400 shadow-inner" placeholder="备份代码..."></textarea>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={handleExport} className="py-4 bg-slate-900 text-white rounded-2xl text-xs font-black shadow-lg">导出数据</button>
              <button onClick={handleImport} className="py-4 bg-blue-600 text-white rounded-2xl text-xs font-black shadow-lg">导入数据</button>
            </div>
          </div>
        </div>
      )}

      <div className="p-6">
        {view === 'LIST' ? (
          <div className="animate-in fade-in">
            <div className="grid grid-cols-4 gap-3 mb-8">
              <button onClick={() => setView('ACC')} className="p-3 bg-blue-50 text-blue-600 rounded-2xl flex flex-col items-center gap-2 border border-blue-100 shadow-sm"><Wallet size={20}/><span className="text-[9px] font-black uppercase tracking-tighter">账号</span></button>
              <button onClick={() => setView('TX')} className="p-3 bg-rose-50 text-rose-600 rounded-2xl flex flex-col items-center gap-2 border border-rose-100 shadow-sm"><Plus size={20}/><span className="text-[9px] font-black uppercase tracking-tighter">记账</span></button>
              <button onClick={() => setView('CAT')} className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl flex flex-col items-center gap-2 border border-indigo-100 shadow-sm"><Tag size={20}/><span className="text-[9px] font-black uppercase tracking-tighter">分类</span></button>
              <button onClick={() => setView('AUTO')} className="p-3 bg-amber-50 text-amber-600 rounded-2xl flex flex-col items-center gap-2 border border-amber-100 shadow-sm"><Calendar size={20}/><span className="text-[9px] font-black uppercase tracking-tighter">固定</span></button>
            </div>

            <button onClick={() => setView('CHART')} className="w-full mb-8 p-6 bg-slate-800 text-white rounded-[2.5rem] flex items-center justify-between shadow-2xl">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/10 rounded-2xl"><PieIcon size={24}/></div>
                <div className="text-left"><p className="text-sm font-black uppercase">报表分析</p></div>
              </div>
              <ChevronRight size={20} className="opacity-30"/>
            </button>
            
            <div className="space-y-4">
              {monthlyTxs.slice().reverse().map(t => (
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
        ) : (
          <div className="flex flex-col items-center py-20">
             <button onClick={() => setView('LIST')} className="flex items-center gap-2 text-slate-400 mb-8 text-xs font-black uppercase"><ArrowLeft size={16}/> 返回主页</button>
          </div>
        )}
      </div>
    </div>
  );
}