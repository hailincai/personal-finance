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

  const getStatsFor = (type: 'INCOME' | 'EXPENSE') => {
    const res: Record<string, number> = {};
    filteredTxs.filter(t => type === 'INCOME' ? t.amount > 0 : t.amount < 0).forEach(t => {
      res[t.category] = (res[t.category] || 0) + Math.abs(t.amount);
    });
    return Object.entries(res).sort((a,b) => b[1] - a[1]);
  };

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

  const getConicGradient = (category: string, type: 'INCOME' | 'EXPENSE', total: number) => {
    const accStats = getAccountStatsForCat(category, type);
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];
    let currentPercent = 0;
    const pieces = accStats.map(([_, val], idx) => {
      const start = currentPercent;
      const end = start + (val / total) * 100;
      currentPercent = end;
      return `${colors[idx % colors.length]} ${start}% ${end}%`;
    });
    return pieces.length > 0 ? `conic-gradient(${pieces.join(', ')})` : '#f1f5f9';
  };

  const pushToCloud = async () => {
    if (!sbUrl || !sbKey) return alert('请输入 Supabase 配置');
    setIsSyncing(true);
    const supabase = createClient(sbUrl, sbKey);
    try {
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
    if (!sbUrl || !sbKey) return alert('请输入 Supabase 配置');
    setIsSyncing(true);
    const supabase = createClient(sbUrl, sbKey);
    try {
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

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen pb-20 shadow-2xl relative overflow-x-hidden">
      <div className="bg-slate-900 p-8 text-white rounded-b-[3rem] shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl font-black italic tracking-tighter uppercase">Finance V53.1</h1>
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
          <div className="bg-white/5 border border-white/10 p-5 rounded-[2rem]">
            <p className="text-[9px] font-bold opacity-40 uppercase mb-1">本月收入</p>
            <p className="font-mono font-bold text-emerald-400 text-xl">¥{summary.income.toFixed(2)}</p>
          </div>
          <div className="bg-white/5 border border-white/10 p-5 rounded-[2rem]">
            <p className="text-[9px] font-bold opacity-40 uppercase mb-1">本月支出</p>
            <p className="font-mono font-bold text-rose-400 text-xl">¥{summary.expense.toFixed(2)}</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        {view === 'LIST' && (
          <>
            <div className="grid grid-cols-4 gap-3 mb-8">
              <button onClick={() => setView('ACCOUNT')} className="p-4 bg-blue-50 text-blue-600 rounded-2xl flex flex-col items-center gap-2"><Wallet size={20}/><span className="text-[9px] font-black uppercase">账号</span></button>
              <button onClick={() => setView('ADD')} className="p-4 bg-rose-50 text-rose-600 rounded-2xl flex flex-col items-center gap-2"><Plus size={20}/><span className="text-[9px] font-black uppercase">记账</span></button>
              <button onClick={() => setView('CAT')} className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl flex flex-col items-center gap-2"><Tag size={20}/><span className="text-[9px] font-black uppercase">分类</span></button>
              <button onClick={() => setView('AUTO')} className="p-4 bg-amber-50 text-amber-600 rounded-2xl flex flex-col items-center gap-2"><Calendar size={20}/><span className="text-[9px] font-black uppercase">固定</span></button>
            </div>

            <button onClick={() => setView('STATS')} className="w-full mb-8 p-6 bg-slate-50 rounded-[2.5rem] flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white rounded-2xl shadow-sm"><PieChart size={24}/></div>
                <div className="text-left">
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">分析看板</p>
                  <p className="text-sm font-bold text-slate-900">查看支出分布</p>
                </div>
              </div>
              <ChevronRight className="text-slate-300"/>
            </button>

            <div className="space-y-4">
              {filteredTxs.map(t => (
                <div key={t.id} className="flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400"><Zap size={18}/></div>
                    <div><p className="font-bold text-sm">{t.description}</p><p className="text-[10px] text-slate-400 font-bold uppercase">{t.date} · {t.category}</p></div>
                  </div>
                  <span className={`font-mono font-bold text-sm ${t.amount < 0 ? 'text-rose-500':'text-emerald-500'}`}>{t.amount > 0 ? '+' : ''}{t.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {view === 'STATS' && (
          <div className="animate-in slide-in-from-right duration-200">
            <button onClick={() => { setView('LIST'); setSelectedCat(null); }} className="mb-6 flex items-center gap-2 text-slate-400 font-black text-[10px] uppercase tracking-widest"><ArrowLeft size={16}/> 返回</button>
            <div className="flex p-1 bg-slate-100 rounded-2xl mb-8">
              <button onClick={() => { setStatsTab('EXPENSE'); setSelectedCat(null); }} className={`flex-1 py-3 rounded-xl font-black text-[10px] transition-all ${statsTab === 'EXPENSE' ? 'bg-white shadow-sm text-rose-500' : 'text-slate-400'}`}>支出排行</button>
              <button onClick={() => { setStatsTab('INCOME'); setSelectedCat(null); }} className={`flex-1 py-3 rounded-xl font-black text-[10px] transition-all ${statsTab === 'INCOME' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-400'}`}>收入排行</button>
            </div>
            <div className="space-y-4">
              {getStatsFor(statsTab as any).map(([name, val]) => (
                <div key={name} className="bg-slate-50 rounded-3xl p-4">
                  <button onClick={() => setSelectedCat(selectedCat === name ? null : name)} className="w-full text-left">
                    <div className="flex justify-between items-end mb-2">
                      <span className="font-bold text-sm">{name}</span>
                      <span className="font-mono font-bold text-sm">¥{val.toFixed(2)}</span>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div className={`h-full ${statsTab === 'EXPENSE' ? 'bg-rose-400' : 'bg-emerald-400'}`} style={{ width: `${(val / (statsTab === 'EXPENSE' ? summary.expense : summary.income || 1)) * 100}%` }}></div>
                    </div>
                  </button>
                  {selectedCat === name && (
                    <div className="mt-6 pt-6 border-t border-slate-200 flex items-center gap-8 animate-in zoom-in-95">
                      <div className="w-24 h-24 rounded-full flex items-center justify-center relative shadow-md" style={{ background: getConicGradient(name, statsTab as any, val) }}>
                        <div className="w-16 h-16 bg-slate-50 rounded-full"></div>
                      </div>
                      <div className="flex-1 space-y-2">
                        {getAccountStatsForCat(name, statsTab as any).map(([acc, accVal], idx) => (
                          <div key={acc} className="flex items-center justify-between text-[10px] font-bold">
                            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'][idx % 5] }}></div>{acc}</div>
                            <span>{((accVal/val)*100).toFixed(1)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'ACCOUNT' && (
          <div className="animate-in slide-in-from-right duration-200">
            <button onClick={() => setView('LIST')} className="mb-6 flex items-center gap-2 text-slate-400 font-black text-[10px] uppercase tracking-widest"><ArrowLeft size={16}/> 返回</button>
            <h2 className="text-xl font-black mb-6 italic">Accounts</h2>
            <div className="flex gap-2 mb-8">
              <input value={newAccName} onChange={e=>setNewAccName(e.target.value)} placeholder="新账号名称" className="flex-1 p-4 bg-slate-50 rounded-2xl font-bold text-sm outline-none" />
              <button onClick={async ()=>{ if(!newAccName)return; await db.accounts.add({id:generateId(), name:newAccName, type:'CASH', balance:0}); setNewAccName(''); }} className="p-4 bg-blue-600 text-white rounded-2xl"><Plus/></button>
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

        {view === 'CAT' && (
          <div className="animate-in slide-in-from-right duration-200">
            <button onClick={() => setView('LIST')} className="mb-6 flex items-center gap-2 text-slate-400 font-black text-[10px] uppercase tracking-widest"><ArrowLeft size={16}/> 返回</button>
            <h2 className="text-xl font-black mb-6 italic">Categories</h2>
            <div className="flex gap-2 mb-8">
              <input value={newCat} onChange={e=>setNewCat(e.target.value)} placeholder="新分类" className="flex-1 p-4 bg-slate-50 rounded-2xl font-bold text-sm outline-none" />
              <button onClick={async ()=>{ if(!newCat)return; await db.categories.add({id:generateId(), name:newCat}); setNewCat(''); }} className="p-4 bg-indigo-600 text-white rounded-2xl"><Plus/></button>
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

        {view === 'AUTO' && (
          <div className="animate-in slide-in-from-right duration-200">
            <button onClick={() => setView('LIST')} className="mb-6 flex items-center gap-2 text-slate-400 font-black text-[10px] uppercase tracking-widest"><ArrowLeft size={16}/> 返回</button>
            <h2 className="text-xl font-black mb-6 italic">Recurring</h2>
            <div className="space-y-4 mb-8 bg-slate-50 p-6 rounded-[2rem]">
              <input type="number" value={amt} onChange={e=>setAmt(e.target.value)} placeholder="金额" className="w-full p-4 bg-white rounded-2xl font-bold text-sm outline-none" />
              <input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="描述 (如: 房租)" className="w-full p-4 bg-white rounded-2xl font-bold text-sm outline-none" />
              <input type="number" value={autoDay} onChange={e=>setAutoDay(e.target.value)} placeholder="每月几号" className="w-full p-4 bg-white rounded-2xl font-bold text-sm outline-none" />
              <select value={accId} onChange={e=>setAccId(e.target.value)} className="w-full p-4 bg-white rounded-2xl font-bold text-sm outline-none">
                <option value="">选择账号</option>
                {accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <button onClick={async ()=>{ if(!amt || !accId || !autoDay)return; await db.autoTemplates.add({id:generateId(), amount:parseFloat(amt), description:desc, dayOfMonth:parseInt(autoDay), accountId:accId, category:'固定'}); setAmt(''); setDesc(''); setAutoDay(''); setView('LIST'); }} className="w-full py-4 bg-amber-500 text-white rounded-2xl font-black shadow-lg">存为模板</button>
            </div>
            <div className="space-y-2">
              {autos.map(au=>(
                <div key={au.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                  <div><p className="font-bold text-sm">{au.description}</p><p className="text-[10px] text-slate-400 font-bold">每月 {au.dayOfMonth} 号 · ¥{au.amount}</p></div>
                  <button onClick={()=>db.autoTemplates.delete(au.id)} className="text-rose-500 p-2"><Trash2 size={16}/></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'ADD' && (
          <div className="animate-in slide-in-from-right duration-200">
            <button onClick={() => setView('LIST')} className="mb-6 flex items-center gap-2 text-slate-400 font-black text-[10px] uppercase tracking-widest"><ArrowLeft size={16}/> 返回</button>
            <h2 className="text-xl font-black mb-6 italic">New Transaction</h2>
            <div className="space-y-4">
              <input type="number" value={amt} onChange={e=>setAmt(e.target.value)} placeholder="金额 (支出需输入 - 号)" className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-sm outline-none" />
              <input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="备注" className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-sm outline-none" />
              <select value={accId} onChange={e=>setAccId(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-sm outline-none">
                <option value="">选择账号</option>
                {accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <select value={cat} onChange={e=>setCat(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-sm outline-none">
                <option value="">选择分类</option>
                {categories.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
              <button onClick={handleAddTx} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black shadow-lg">保存账单</button>
            </div>
          </div>
        )}
      </div>

      {showSync && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-[360px] rounded-[2.5rem] p-8 shadow-2xl relative">
            <button onClick={()=>setShowSync(false)} className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full text-slate-400"><X size={16}/></button>
            <h2 className="text-xl font-black mb-1 italic">Cloud Sync</h2>
            <div className="space-y-4 mb-8 mt-6">
              <input value={sbUrl} onChange={e=>setSbUrl(e.target.value)} placeholder="URL" className="w-full p-4 bg-slate-50 rounded-2xl text-[10px] font-mono outline-none" />
              <input value={sbKey} type="password" onChange={e=>setSbKey(e.target.value)} placeholder="Key" className="w-full p-4 bg-slate-50 rounded-2xl text-[10px] font-mono outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={pushToCloud} disabled={isSyncing} className="py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] flex flex-col items-center gap-2"><CloudUpload size={18}/> PUSH</button>
              <button onClick={pullFromCloud} disabled={isSyncing} className="py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] flex flex-col items-center gap-2"><DownloadCloud size={18}/> PULL</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
