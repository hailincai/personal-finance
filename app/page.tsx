
'use client';
import { useState, useMemo } from 'react';
import { db } from '../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Wallet, CreditCard, Tag, Calendar, ArrowLeft, Zap, ChevronLeft, ChevronRight, PieChart as PieIcon, Plus, Settings } from 'lucide-react';

// 定义明确的类型接口以修复 Vercel 构建错误
interface CatStat {
  total: number;
  accounts: Record<number, number>;
}

const SimplePieChart = ({ data }: { data: { label: string, value: number, color: string }[] }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  let cumulativePercent = 0;
  const getCoordinatesForPercent = (percent: number) => [Math.cos(2 * Math.PI * percent), Math.sin(2 * Math.PI * percent)];
  return (
    <div className="flex items-center gap-6 py-4">
      <svg viewBox="-1 -1 2 2" className="w-24 h-24 -rotate-90">
        {data.map((slice, i) => {
          const [startX, startY] = getCoordinatesForPercent(cumulativePercent);
          cumulativePercent += slice.value / total;
          const [endX, endY] = getCoordinatesForPercent(cumulativePercent);
          const pathData = `M ${startX} ${startY} A 1 1 0 ${slice.value/total > 0.5 ? 1 : 0} 1 ${endX} ${endY} L 0 0`;
          return <path key={i} d={pathData} fill={slice.color} />;
        })}
      </svg>
      <div className="flex flex-col gap-1">
        {data.map((slice, i) => (
          <div key={i} className="flex items-center gap-2 text-[9px] font-bold">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: slice.color }}></div>
            <span className="text-slate-500 truncate w-20">{slice.label}</span>
            <span className="text-slate-900">{((slice.value/total)*100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function Home() {
  const [view, setView] = useState('LIST');
  const [chartTab, setChartTab] = useState('EXP');
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());

  const monthStr = useMemo(() => {
    const y = currentDate.getFullYear();
    const m = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    return `${y}-${m}`;
  }, [currentDate]);

  const accounts = useLiveQuery(() => db.accounts.toArray());
  const allTxs = useLiveQuery(() => db.transactions.toArray());
  const monthlyTxs = useMemo(() => allTxs?.filter(t => t.date.startsWith(monthStr)) || [], [allTxs, monthStr]);

  const reportData = useMemo(() => {
    const filtered = monthlyTxs.filter(t => chartTab === 'EXP' ? t.amount < 0 : t.amount > 0);
    const totalAmount = filtered.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    // 修复构建错误的关键：显式声明对象类型
    const catMap: Record<string, CatStat> = {};
    
    filtered.forEach(t => {
      if (!catMap[t.category]) catMap[t.category] = { total: 0, accounts: {} };
      const absAmt = Math.abs(t.amount);
      catMap[t.category].total += absAmt;
      catMap[t.category].accounts[t.accountId] = (catMap[t.category].accounts[t.accountId] || 0) + absAmt;
    });

    const colors = ['#6366f1', '#f43f5e', '#fbbf24', '#10b981', '#8b5cf6'];
    return Object.entries(catMap).map(([name, data]) => ({
      name,
      amount: data.total,
      percent: totalAmount > 0 ? (data.total / totalAmount) * 100 : 0,
      pieData: Object.entries(data.accounts).map(([aid, amt], idx) => ({
        label: accounts?.find(a => a.id === parseInt(aid))?.name || '未知',
        value: amt,
        color: colors[idx % colors.length]
      }))
    })).sort((a, b) => b.amount - a.amount);
  }, [monthlyTxs, chartTab, accounts]);

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen pb-12 shadow-2xl font-sans text-slate-900">
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-white rounded-b-[3rem] shadow-xl">
        <h1 className="text-xl font-black mb-6 tracking-tight">财务管理</h1>
        {/* 锁定垂直布局 */}
        <div className="flex flex-col gap-3">
          {accounts?.map(a => (
            <div key={a.id} className="flex justify-between items-center bg-white/10 p-4 rounded-2xl border border-white/5 shadow-inner">
              <span className="text-[11px] font-bold uppercase tracking-widest opacity-80">{a.name}</span>
              <span className="font-mono font-bold text-lg text-blue-200">¥{a.balance.toFixed(2)}</span>
            </div>
          ))}
          {(!accounts || accounts.length === 0) && <p className="text-xs opacity-60 text-center italic py-4">当前无账号，请点击下方按钮添加</p>}
        </div>
      </div>

      <div className="p-6">
        {view === 'LIST' ? (
          <div className="animate-in fade-in">
            <div className="grid grid-cols-4 gap-3 mb-8">
              <button onClick={() => setView('ACC')} className="p-3 bg-blue-50 text-blue-600 rounded-2xl flex flex-col items-center gap-2 border border-blue-100"><Wallet size={20}/><span className="text-[9px] font-black uppercase tracking-tighter">账号</span></button>
              <button onClick={() => setView('TX')} className="p-3 bg-rose-50 text-rose-600 rounded-2xl flex flex-col items-center gap-2 border border-rose-100"><Plus size={20}/><span className="text-[9px] font-black uppercase tracking-tighter">记账</span></button>
              <button onClick={() => setView('CAT')} className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl flex flex-col items-center gap-2 border border-indigo-100"><Tag size={20}/><span className="text-[9px] font-black uppercase tracking-tighter">分类</span></button>
              <button onClick={() => setView('AUTO')} className="p-3 bg-amber-50 text-amber-600 rounded-2xl flex flex-col items-center gap-2 border border-amber-100"><Calendar size={20}/><span className="text-[9px] font-black uppercase tracking-tighter">固定</span></button>
            </div>

            <button onClick={() => setView('CHART')} className="w-full mb-8 p-6 bg-slate-900 text-white rounded-[2.5rem] flex items-center justify-between shadow-2xl active:scale-95 transition-all">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/10 rounded-2xl"><PieIcon size={24}/></div>
                <div className="text-left">
                  <p className="text-sm font-black tracking-widest uppercase">报表分析</p>
                  <p className="text-[10px] opacity-40 font-bold">{monthStr} 消费结构分析</p>
                </div>
              </div>
              <ChevronRight size={20} className="opacity-30"/>
            </button>

            <div className="flex justify-between items-center mb-6 px-1">
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">最近流水</h2>
              <div className="flex items-center gap-3 bg-slate-100 px-3 py-1 rounded-full text-[10px] font-black">
                <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth()-1, 1))}><ChevronLeft size={14}/></button>
                <span>{monthStr}</span>
                <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth()+1, 1))}><ChevronRight size={14}/></button>
              </div>
            </div>
            
            <div className="space-y-4">
              {monthlyTxs.slice().reverse().map(t => (
                <div key={t.id} className="flex justify-between items-center px-1">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${t.amount < 0 ? 'bg-rose-50 text-rose-500':'bg-emerald-50 text-emerald-500'}`}><Zap size={18}/></div>
                    <div><p className="font-bold text-sm">{t.description}</p><p className="text-[10px] text-slate-400 font-bold uppercase">{t.date} · {t.category}</p></div>
                  </div>
                  <span className={`font-mono font-bold text-sm ${t.amount < 0 ? 'text-rose-500':'text-emerald-600'}`}>{t.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : view === 'CHART' ? (
          <div className="animate-in slide-in-from-right">
            <button onClick={() => setView('LIST')} className="flex items-center gap-2 text-slate-400 mb-8 text-xs font-black uppercase"><ArrowLeft size={16}/> 返回主页</button>
            <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-8">
              <button onClick={()=>setChartTab('EXP')} className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${chartTab==='EXP'?'bg-white text-rose-600 shadow-md':'text-slate-400'}`}>支出</button>
              <button onClick={()=>setChartTab('INC')} className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${chartTab==='INC'?'bg-white text-emerald-600 shadow-md':'text-slate-400'}`}>收入</button>
            </div>
            <div className="space-y-4">
              {reportData.map(item => (
                <div key={item.name} className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden shadow-sm">
                  <div onClick={() => setExpandedCat(expandedCat === item.name ? null : item.name)} className="p-6 flex items-center justify-between cursor-pointer active:bg-slate-50 transition-colors">
                    <div className="flex-1">
                      <div className="flex justify-between mb-3 text-sm font-black">
                        <span>{item.name} <span className="text-[10px] text-slate-300 ml-2">{item.percent.toFixed(1)}%</span></span>
                        <span className="font-mono">¥{item.amount.toFixed(0)}</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full transition-all duration-700 ${chartTab==='EXP'?'bg-rose-400':'bg-emerald-400'}`} style={{width: `${item.percent}%`}}></div>
                      </div>
                    </div>
                  </div>
                  {expandedCat === item.name && (
                    <div className="px-6 pb-6 pt-2 bg-slate-50 border-t border-slate-100 animate-in fade-in">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-1"><Settings size={10}/> 账号分布饼图</p>
                      <SimplePieChart data={item.pieData} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <button onClick={() => setView('LIST')} className="flex items-center gap-2 text-slate-400 mb-8 text-xs font-black uppercase tracking-widest"><ArrowLeft size={16}/> 返回主页</button>
            <p className="text-center py-20 text-[10px] font-black text-slate-200 italic">子模块正在重新挂载代码...</p>
          </div>
        )}
      </div>
    </div>
  );
}