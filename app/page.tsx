'use client';
import { useState, useEffect, useMemo } from 'react';
import { db, runMigration, generateId } from '../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { createClient } from '@supabase/supabase-js';
import { Wallet, Tag, Calendar, ChevronRight, Plus, RefreshCw, X, CloudUpload, Zap, DownloadCloud, ArrowLeft, Trash2, PieChart, ChevronLeft } from 'lucide-react';

export default function Home() {
  const [view, setView] = useState('LIST');
  const [showSync, setShowSync] = useState(false);
  const [sbUrl, setSbUrl] = useState('');
  const [sbKey, setSbKey] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const monthStr = useMemo(() => {
    const y = currentDate.getFullYear();
    const m = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    return `${y}-${m}`;
  }, [currentDate]);

  const changeMonth = (offset: number) => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() + offset);
    setCurrentDate(d);
  };

  const [amt, setAmt] = useState('');
  const [desc, setDesc] = useState('');
  const [accId, setAccId] = useState('');
  const [cat, setCat] = useState('');
  const [newCat, setNewCat] = useState('');
  const [newAccName, setNewAccName] = useState('');
  const [autoDay, setAutoDay] = useState('');
  
  const [statsTab, setStatsTab] = useState('EXPENSE'); 
  const [selectedCat, setSelectedCat] = useState<string | null>(null);

  useEffect(() => { 
    runMigration();
    setSbUrl(localStorage.getItem('sb_url') || '');
    setSbKey(localStorage.getItem('sb_key') || '');
  }, []);

  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const categories = useLiveQuery(() => db.categories.toArray()) || [];
  const allTxs = useLiveQuery(() => db.transactions.toArray()) || [];
  const autos = useLiveQuery(() => db.autoTemplates.toArray()) || [];

  const filteredTxs = useMemo(() => {
    return allTxs.filter(t => t.date.startsWith(monthStr)).sort((a,b) => b.date.localeCompare(a.date));
  }, [allTxs, monthStr]);

  const summary = useMemo(() => {
    let inc = 0, exp = 0;
    filteredTxs.forEach(t => {
      if (t.amount > 0) inc += t.amount;
      else exp += t.amount;
    });
    return { income: inc, expense: Math.abs(exp) };
  }, [filteredTxs]);

  // 分类统计逻辑
  const getStatsFor = (type: 'INCOME' | 'EXPENSE') => {
    const res: Record<string, number> = {};
    filteredTxs.filter(t => type === 'INCOME' ? t.amount > 0 : t.amount < 0).forEach(t => {
      res[t.category] = (res[t.category] || 0) + Math.abs(t.amount);
    });
    return Object.entries(res).sort((a,b) => b[1] - a[1]);
  };

  // 账户贡献逻辑
  const getAccountStatsForCat = (category: string, type: 'INCOME' | 'EXPENSE') => {
    const res: Record<string, number> = {};
    const txs = filteredTxs.filter(t => t.category === category && (type === 'INCOME' ? t.amount > 0 : t.amount < 0));
    txs.forEach(t => {
      const acc = accounts.find(a => a.id === t.accountId)?.name || '未知账户';
      res[acc] = (res[acc] || 0) + Math.abs(t.amount);
    });
    return Object.entries(res).sort((a,b) => b[1] - a[1]);
  };

  const handleAddTx = async () => {
    if (!amt || !accId) return;
    const val = parseFloat(amt);
    await db.transactions.add({ id: generateId(), amount: val, description: desc || '未分类', date: new Date().toISOString().split('T')[0], accountId: accId, category: cat || '默认' });
    const ac = await db.accounts.get(accId);
    if (ac) await db.accounts.update(accId, { balance: ac.balance + val });
    setAmt(''); setDesc(''); setView('LIST');
  };

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen pb-20 shadow-2xl relative overflow-x-hidden">
      {/* 顶部状态 */}
      <div className="bg-slate-900 p-8 text-white rounded-b-[3rem] shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl font-black italic tracking-tighter uppercase">Finance V52</h1>
          <button onClick={() => setShowSync(true)} className="p-2 bg-blue-600 rounded-2xl active:scale-95 transition-all">
            <RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''}/>
          </button>
        </div>
        
        <div className="flex justify-between items-center bg-white/10 rounded-2xl p-2 mb-6">
          <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-white/10 rounded-xl"><ChevronLeft size={20}/></button>
          <span className="font-black italic text-sm tracking-widest uppercase">{monthStr}</span>
          <button onClick={() => changeMonth(1)} className="p-2 hover:bg-white/10 rounded-xl"><ChevronRight size={20}/></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/5 border border-white/10 p-4 rounded-[2rem]">
            <p className="text-[9px] font-bold opacity-40 uppercase mb-1">月收入</p>
            <p className="font-mono font-bold text-emerald-400 text-lg">¥{summary.income.toFixed(2)}</p>
          </div>
          <div className="bg-white/5 border border-white/10 p-4 rounded-[2rem]">
            <p className="text-[9px] font-bold opacity-40 uppercase mb-1">月支出</p>
            <p className="font-mono font-bold text-rose-400 text-lg">¥{summary.expense.toFixed(2)}</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        {view === 'LIST' && (
          <>
            <div className="grid grid-cols-4 gap-3 mb-8">
              <button onClick={() => setView('ACCOUNT')} className="p-3 bg-blue-50 text-blue-600 rounded-2xl flex flex-col items-center gap-2 transition-colors"><Wallet size={20}/><span className="text-[9px] font-black uppercase">账号</span></button>
              <button onClick={() => setView('ADD')} className="p-3 bg-rose-50 text-rose-600 rounded-2xl flex flex-col items-center gap-2 transition-colors"><Plus size={20}/><span className="text-[9px] font-black uppercase">记账</span></button>
              <button onClick={() => setView('CAT')} className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl flex flex-col items-center gap-2 transition-colors"><Tag size={20}/><span className="text-[9px] font-black uppercase">分类</span></button>
              <button onClick={() => setView('AUTO')} className="p-3 bg-amber-50 text-amber-600 rounded-2xl flex flex-col items-center gap-2 transition-colors"><Calendar size={20}/><span className="text-[9px] font-black uppercase">固定</span></button>
            </div>

            <button onClick={() => setView('STATS')} className="w-full mb-8 p-6 bg-slate-50 rounded-[2.5rem] flex items-center justify-between active:scale-95 transition-all group">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white rounded-2xl shadow-sm group-hover:bg-slate-900 group-hover:text-white transition-all"><PieChart size={24}/></div>
                <div className="text-left">
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">分析看板</p>
                  <p className="text-sm font-bold text-slate-900">查看分类及账户占比</p>
                </div>
              </div>
              <ChevronRight className="text-slate-300"/>
            </button>

            <div className="space-y-4">
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">该月流水</h2>
              {filteredTxs.map(t => (
                <div key={t.id} className="flex justify-between items-center group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-slate-900 group-hover:text-white transition-all"><Zap size={18}/></div>
                    <div><p className="font-bold text-sm">{t.description}</p><p className="text-[10px] text-slate-400 font-bold uppercase">{t.date} · {t.category}</p></div>
                  </div>
                  <span className={`font-mono font-bold text-sm ${t.amount < 0 ? 'text-rose-500':'text-emerald-600'}`}>{t.amount > 0 ? '+' : ''}{t.amount.toFixed(2)}</span>
                </div>
              ))}
              {filteredTxs.length === 0 && <p className="text-center py-10 text-slate-300 text-[10px] font-black italic">No records this month</p>}
            </div>
          </>
        )}

        {view === 'STATS' && (
          <div className="animate-in slide-in-from-right duration-200">
            <button onClick={() => { setView('LIST'); setSelectedCat(null); }} className="mb-6 flex items-center gap-2 text-slate-400 font-black text-[10px] uppercase tracking-widest"><ArrowLeft size={16}/> 返回列表</button>
            
            <div className="flex p-1 bg-slate-100 rounded-2xl mb-8">
              <button onClick={() => { setStatsTab('EXPENSE'); setSelectedCat(null); }} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase transition-all ${statsTab === 'EXPENSE' ? 'bg-white shadow-sm text-rose-500' : 'text-slate-400'}`}>支出排行</button>
              <button onClick={() => { setStatsTab('INCOME'); setSelectedCat(null); }} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase transition-all ${statsTab === 'INCOME' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-400'}`}>收入排行</button>
            </div>

            <div className="space-y-4">
              {getStatsFor(statsTab as any).map(([name, val]) => (
                <div key={name} className="bg-slate-50/50 rounded-3xl p-4 transition-all">
                  <button onClick={() => setSelectedCat(selectedCat === name ? null : name)} className="w-full text-left">
                    <div className="flex justify-between items-end mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">{name}</span>
                        {selectedCat === name ? <ChevronRight size={14} className="rotate-90 text-blue-500 transition-transform"/> : <ChevronRight size={14} className="text-slate-300"/>}
                      </div>
                      <span className="font-mono font-bold text-sm">¥{val.toFixed(2)}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${statsTab === 'EXPENSE' ? 'bg-rose-400' : 'bg-emerald-400'}`} style={{ width: `${(val / (statsTab === 'EXPENSE' ? summary.expense : summary.income || 1)) * 100}%` }}></div>
                    </div>
                  </button>

                  {/* 账户百分比饼图区域 (简化饼图实现) */}
                  {selectedCat === name && (
                    <div className="mt-6 pt-6 border-t border-slate-200/50 animate-in zoom-in-95 duration-200">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">账户贡献比例</p>
                      <div className="flex items-center gap-8">
                         {/* 简易 CSS 饼图渲染 */}
                         <div className="relative w-24 h-24 rounded-full bg-slate-200 overflow-hidden flex-shrink-0">
                            {getAccountStatsForCat(name, statsTab as any).map(([accName, accVal], idx, arr) => {
                               let offset = 0;
                               for(let i=0; i<idx; i++) offset += (arr[i][1]/val)*360;
                               const deg = (accVal/val)*360;
                               const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];
                               return (
                                 <div key={accName} className="absolute inset-0" style={{
                                   clipPath: deg > 180 ? 'none' : 'inset(0 0 0 50%)',
                                   transform: `rotate(${offset}deg)`
                                 }}>
                                    <div className="absolute inset-0 rounded-full" style={{
                                      backgroundColor: colors[idx % colors.length],
                                      transform: `rotate(${deg}deg)`,
                                      clipPath: 'inset(0 50% 0 0)'
                                    }}></div>
                                 </div>
                               )
                            })}
                            <div className="absolute inset-2 bg-white rounded-full flex items-center justify-center">
                               <PieChart size={16} className="text-slate-200"/>
                            </div>
                         </div>
                         <div className="flex-1 space-y-2">
                            {getAccountStatsForCat(name, statsTab as any).map(([accName, accVal], idx) => (
                              <div key={accName} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'][idx % 5] }}></div>
                                  <span className="text-[10px] font-bold text-slate-600">{accName}</span>
                                </div>
                                <span className="text-[10px] font-mono font-black text-slate-400">{((accVal/val)*100).toFixed(1)}%</span>
                              </div>
                            ))}
                         </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 账号管理 */}
        {view === 'ACCOUNT' && (
          <div className="animate-in slide-in-from-right duration-200">
            <button onClick={() => setView('LIST')} className="mb-6 flex items-center gap-2 text-slate-400 font-black text-[10px] uppercase tracking-widest"><ArrowLeft size={16}/> 返回</button>
            <h2 className="text-xl font-black mb-6 italic">Accounts</h2>
            <div className="flex gap-2 mb-8">
              <input value={newAccName} onChange={e=>setNewAccName(e.target.value)} placeholder="新账号名称" className="flex-1 p-4 bg-slate-50 border-none rounded-2xl font-bold text-sm outline-none focus:ring-2 ring-blue-500/20" />
              <button onClick={async ()=>{ if(!newAccName)return; await db.accounts.add({id:generateId(), name:newAccName, type:'CASH', balance:0}); setNewAccName(''); }} className="p-4 bg-blue-600 text-white rounded-2xl active:scale-95"><Plus/></button>
            </div>
            <div className="space-y-2">
              {accounts.map(a=>(
                <div key={a.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                  <span className="font-bold text-sm">{a.name} (¥{a.balance.toFixed(2)})</span>
                  <button onClick={()=>db.accounts.delete(a.id)} className="text-rose-500 p-2"><Trash2 size={16}/></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 记账表单 */}
        {view === 'ADD' && (
          <div className="animate-in slide-in-from-right duration-200">
            <button onClick={() => setView('LIST')} className="mb-6 flex items-center gap-2 text-slate-400 font-black text-[10px] uppercase tracking-widest"><ArrowLeft size={16}/> 返回</button>
            <h2 className="text-xl font-black mb-6 italic">New Transaction</h2>
            <div className="space-y-4">
              <input type="number" value={amt} onChange={e=>setAmt(e.target.value)} placeholder="金额 (支出需输入 - 号)" className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold text-sm outline-none" />
              <input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="备注" className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold text-sm outline-none" />
              <select value={accId} onChange={e=>setAccId(e.target.value)} className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold text-sm appearance-none outline-none">
                <option value="">选择账号</option>
                {accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <select value={cat} onChange={e=>setCat(e.target.value)} className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold text-sm appearance-none outline-none">
                <option value="">选择分类</option>
                {categories.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
              <button onClick={handleAddTx} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black shadow-lg active:scale-95 transition-all">保存账单</button>
            </div>
          </div>
        )}
        
        {/* 分类管理 */}
        {view === 'CAT' && (
          <div className="animate-in slide-in-from-right duration-200">
            <button onClick={() => setView('LIST')} className="mb-6 flex items-center gap-2 text-slate-400 font-black text-[10px] uppercase tracking-widest"><ArrowLeft size={16}/> 返回</button>
            <h2 className="text-xl font-black mb-6 italic">Categories</h2>
            <div className="flex gap-2 mb-8">
              <input value={newCat} onChange={e=>setNewCat(e.target.value)} placeholder="新分类" className="flex-1 p-4 bg-slate-50 border-none rounded-2xl font-bold text-sm outline-none" />
              <button onClick={async ()=>{ if(!newCat)return; await db.categories.add({id:generateId(), name:newCat}); setNewCat(''); }} className="p-4 bg-indigo-600 text-white rounded-2xl active:scale-95"><Plus/></button>
            </div>
            <div className="space-y-2">
              {categories.map(c=>(
                <div key={c.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                  <span className="font-bold text-sm">{c.name}</span>
                  <button onClick={()=>db.categories.delete(c.id)} className="text-rose-500 p-2"><Trash2 size={16}/></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 固定收支 */}
        {view === 'AUTO' && (
          <div className="animate-in slide-in-from-right duration-200">
            <button onClick={() => setView('LIST')} className="mb-6 flex items-center gap-2 text-slate-400 font-black text-[10px] uppercase tracking-widest"><ArrowLeft size={16}/> 返回</button>
            <h2 className="text-xl font-black mb-6 italic">Recurring</h2>
            <div className="space-y-4 mb-8 bg-slate-50 p-6 rounded-[2rem]">
              <input type="number" value={amt} onChange={e=>setAmt(e.target.value)} placeholder="金额" className="w-full p-4 bg-white border-none rounded-2xl font-bold text-sm outline-none" />
              <input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="描述 (如: 房租)" className="w-full p-4 bg-white border-none rounded-2xl font-bold text-sm outline-none" />
              <input type="number" value={autoDay} onChange={e=>setAutoDay(e.target.value)} placeholder="每月几号" className="w-full p-4 bg-white border-none rounded-2xl font-bold text-sm outline-none" />
              <select value={accId} onChange={e=>setAccId(e.target.value)} className="w-full p-4 bg-white border-none rounded-2xl font-bold text-sm outline-none">
                <option value="">选择账号</option>
                {accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <button onClick={async ()=>{ if(!amt || !accId || !autoDay)return; await db.autoTemplates.add({id:generateId(), amount:parseFloat(amt), description:desc, dayOfMonth:parseInt(autoDay), accountId:accId, category:'固定'}); setAmt(''); setDesc(''); setAutoDay(''); setView('LIST'); }} className="w-full py-4 bg-amber-500 text-white rounded-2xl font-black shadow-lg">存为模板</button>
            </div>
            <div className="space-y-2">
              {autos.map(au=>(
                <div key={au.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                  <div><p className="font-bold text-sm">{au.description}</p><p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">每月 {au.dayOfMonth} 号 · ¥{au.amount}</p></div>
                  <button onClick={()=>db.autoTemplates.delete(au.id)} className="text-rose-500 p-2"><Trash2 size={16}/></button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showSync && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-[360px] rounded-[2.5rem] p-8 shadow-2xl relative text-center">
            <button onClick={()=>setShowSync(false)} className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full text-slate-400"><X size={16}/></button>
            <h2 className="text-xl font-black mb-1 italic">Supabase Sync</h2>
            <div className="space-y-4 mb-8 mt-6 text-left">
              <input value={sbUrl} onChange={e=>setSbUrl(e.target.value)} placeholder="URL" className="w-full p-4 bg-slate-50 border-none rounded-2xl text-[10px] font-mono" />
              <input value={sbKey} type="password" onChange={e=>setSbKey(e.target.value)} placeholder="Key" className="w-full p-4 bg-slate-50 border-none rounded-2xl text-[10px] font-mono" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={pushToCloud} disabled={isSyncing} className="py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] flex flex-col items-center gap-2 active:scale-95 transition-all"><CloudUpload size={18}/> PUSH</button>
              <button onClick={pullFromCloud} disabled={isSyncing} className="py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] flex flex-col items-center gap-2 active:scale-95 transition-all"><DownloadCloud size={18}/> PULL</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}