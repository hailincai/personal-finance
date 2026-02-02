import Dexie, { type Table } from 'dexie';

export interface Account { id: string; name: string; type: string; balance: number; }
export interface Category { id: string; name: string; }
export interface Transaction { id: string; amount: number; description: string; date: string; accountId: string; category: string; }
export interface AutoTemplate { id: string; amount: number; description: string; dayOfMonth: number; accountId: string; category: string; }

export class FinanceDB extends Dexie {
  accounts!: Table<Account>;
  categories!: Table<Category>;
  transactions!: Table<Transaction>;
  autoTemplates!: Table<AutoTemplate>;

  constructor() {
    super('FinanceV18DB_UUID');
    this.version(1).stores({
      accounts: 'id, name, type',
      categories: 'id, &name',
      transactions: 'id, date, accountId',
      autoTemplates: 'id, dayOfMonth'
    });
  }
}

export const db = new FinanceDB();
export const generateId = () => crypto.randomUUID();

export const runMigration = async () => {
  const oldDbName = 'FinanceV18DB';
  const databases = await Dexie.getDatabaseNames();
  if (!databases.includes(oldDbName)) return;

  const oldDb = new Dexie(oldDbName);
  oldDb.version(1).stores({
    accounts: '++id',
    categories: '++id',
    transactions: '++id',
    autoTemplates: '++id'
  });

  try {
    const [oldAccs, oldCats, oldTxs, oldAutos] = await Promise.all([
      oldDb.table('accounts').toArray(),
      oldDb.table('categories').toArray(),
      oldDb.table('transactions').toArray(),
      oldDb.table('autoTemplates').toArray()
    ]);

    if (oldAccs.length === 0 && oldTxs.length === 0) return;

    const accMap: Record<number, string> = {};
    const catMap: Record<number, string> = {};

    await db.transaction('rw', [db.accounts, db.categories, db.transactions, db.autoTemplates], async () => {
      if (await db.accounts.count() > 0) return;

      for (const a of oldAccs) {
        const newId = generateId();
        accMap[a.id] = newId;
        await db.accounts.add({ ...a, id: newId });
      }
      for (const c of oldCats) {
        const newId = generateId();
        catMap[c.id] = newId;
        await db.categories.add({ ...c, id: newId });
      }
      for (const t of oldTxs) {
        await db.transactions.add({ 
          ...t, 
          id: generateId(), 
          accountId: accMap[t.accountId] || 'unknown' 
        });
      }
      for (const at of oldAutos) {
        await db.autoTemplates.add({ 
          ...at, 
          id: generateId(), 
          accountId: accMap[at.accountId] || 'unknown' 
        });
      }
    });
    console.log("Migration successful");
  } catch (e) {
    console.error("Migration failed:", e);
  }
};