
import Dexie, { type Table } from 'dexie';
export interface Account { id?: number; name: string; type: string; balance: number; }
export interface Category { id?: number; name: string; }
export interface Transaction { id?: number; amount: number; description: string; date: string; accountId: number; category: string; }
export interface AutoTemplate { id?: number; amount: number; description: string; dayOfMonth: number; accountId: number; category: string; }

export class FinanceDB extends Dexie {
  accounts!: Table<Account>;
  categories!: Table<Category>;
  transactions!: Table<Transaction>;
  autoTemplates!: Table<AutoTemplate>;
  constructor() {
    super('FinanceV18DB');
    this.version(1).stores({
      accounts: '++id, name, type',
      categories: '++id, &name',
      transactions: '++id, date, accountId',
      autoTemplates: '++id, dayOfMonth'
    });
  }
}
export const db = new FinanceDB();
