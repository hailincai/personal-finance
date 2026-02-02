import Dexie, { type Table } from 'dexie';
export interface Account { id: string; name: string; type: string; balance: number; }
export interface Category { id: string; name: string; }
export interface Transaction { id: string; amount: number; description: string; date: string; accountId: string; category: string; }
export interface AutoTemplate { id: string; amount: number; description: string; dayOfMonth: number; accountId: string; category: string; }

export class FinanceDB extends Dexie {
  accounts!: Table<Account>; categories!: Table<Category>; transactions!: Table<Transaction>; autoTemplates!: Table<AutoTemplate>;
  constructor() {
    super('FinanceV18DB_UUID');
    this.version(1).stores({
      accounts: 'id, name', categories: 'id, &name', transactions: 'id, date, accountId', autoTemplates: 'id, dayOfMonth'
    });
  }
}
export const db = new FinanceDB();
export const generateId = () => crypto.randomUUID();

export const runMigration = async () => {
  const oldDbName = 'FinanceV18DB';
  if (!(await Dexie.getDatabaseNames()).includes(oldDbName)) return;
  const oldDb = new Dexie(oldDbName);
  oldDb.version(1).stores({ accounts: '++id', categories: '++id', transactions: '++id', autoTemplates: '++id' });
  try {
    const [oA, oC, oT, oAu] = await Promise.all([oldDb.table('accounts').toArray(), oldDb.table('categories').toArray(), oldDb.table('transactions').toArray(), oldDb.table('autoTemplates').toArray()]);
    if (!oA.length && !oT.length) return;
    const accMap: Record<number, string> = {};
    await db.transaction('rw', [db.accounts, db.categories, db.transactions, db.autoTemplates], async () => {
      if (await db.accounts.count() > 0) return;
      for (const a of oA) { const nId = generateId(); accMap[a.id] = nId; await db.accounts.add({ ...a, id: nId }); }
      for (const c of oC) { await db.categories.add({ ...c, id: generateId() }); }
      for (const t of oT) { await db.transactions.add({ ...t, id: generateId(), accountId: accMap[t.accountId] || 'unknown' }); }
      for (const at of oAu) { await db.autoTemplates.add({ ...at, id: generateId(), accountId: accMap[at.accountId] || 'unknown' }); }
    });
  } catch (e) { console.error(e); }
};