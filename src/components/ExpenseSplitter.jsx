import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  X,
  ArrowRight,
  Check,
  Trash2,
  Receipt,
  Wallet,
} from 'lucide-react';

const SW = {
  green: '#1CC29F',
  greenDark: '#16a085',
};

const CATEGORIES = [
  { id: 'food', label: 'Food & Drink', emoji: '🍽️' },
  { id: 'transport', label: 'Transport', emoji: '🚌' },
  { id: 'hotel', label: 'Hotel', emoji: '🏨' },
  { id: 'activity', label: 'Activity', emoji: '🎯' },
  { id: 'shopping', label: 'Shopping', emoji: '🛍️' },
  { id: 'other', label: 'Other', emoji: '💰' },
];

const AVATAR_COLORS = [
  'bg-[#1CC29F]', 'bg-[#8e44ad]', 'bg-[#3498db]', 'bg-[#e67e22]',
  'bg-[#e74c3c]', 'bg-[#16a085]', 'bg-[#9b59b6]', 'bg-[#2ecc71]',
];

const getAvatarColor = (index) => AVATAR_COLORS[index % AVATAR_COLORS.length];

function simplifyDebts(balances) {
  const creditors = [];
  const debtors = [];

  Object.entries(balances).forEach(([name, balance]) => {
    if (balance > 0.01) creditors.push({ name, amt: balance });
    if (balance < -0.01) debtors.push({ name, amt: -balance });
  });

  creditors.sort((a, b) => b.amt - a.amt);
  debtors.sort((a, b) => b.amt - a.amt);

  const settlements = [];
  let i = 0;
  let j = 0;

  while (i < creditors.length && j < debtors.length) {
    const amount = Math.min(creditors[i].amt, debtors[j].amt);
    if (amount > 0.01) {
      settlements.push({
        from: debtors[j].name,
        to: creditors[i].name,
        amount: Math.round(amount),
      });
    }
    creditors[i].amt -= amount;
    debtors[j].amt -= amount;
    if (creditors[i].amt < 0.01) i++;
    if (debtors[j].amt < 0.01) j++;
  }

  return settlements;
}

function EmptyState() {
  return (
    <div className="text-center py-14 px-4">
      <div className="text-5xl mb-3">🧾</div>
      <p className="font-semibold text-slate-700 dark:text-slate-200">No expenses yet</p>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
        Tap <span className="font-medium text-[#1CC29F]">Add expense</span> — Splitwise-style splitting ✨
      </p>
    </div>
  );
}

function groupByDate(expenses) {
  const groups = {};
  expenses.forEach((e) => {
    const d = e.date || 'Recent';
    if (!groups[d]) groups[d] = [];
    groups[d].push(e);
  });
  return groups;
}

export default function ExpenseSplitter() {
  const [members, setMembers] = useState(['You']);
  const [newMember, setNewMember] = useState('');
  const [expenses, setExpenses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const defaultForm = () => ({
    title: '',
    amount: '',
    category: 'food',
    paidBy: 'You',
    splitAmong: [...members],
    splitType: 'equal',
    customSplits: {},
  });
  const [form, setForm] = useState(defaultForm());
  const [view, setView] = useState('expenses');

  const addMember = () => {
    const name = newMember.trim();
    if (!name || members.includes(name)) return;
    setMembers((prev) => [...prev, name]);
    setNewMember('');
  };

  const removeMember = (name) => {
    if (name === 'You' || members.length === 1) return;
    setMembers((prev) => prev.filter((m) => m !== name));
    setExpenses((prev) => prev.filter((e) => e.paidBy !== name));
    setForm((f) => ({
      ...f,
      paidBy: f.paidBy === name ? 'You' : f.paidBy,
      splitAmong: f.splitAmong.filter((m) => m !== name),
    }));
  };

  const openForm = () => {
    setForm({ ...defaultForm(), splitAmong: [...members] });
    setShowForm(true);
  };

  const toggleSplitMember = (name) => {
    setForm((f) => {
      const included = f.splitAmong.includes(name);
      return {
        ...f,
        splitAmong: included
          ? f.splitAmong.filter((m) => m !== name)
          : [...f.splitAmong, name],
      };
    });
  };

  const equalShare = () => {
    const amt = parseFloat(form.amount);
    if (!amt || form.splitAmong.length === 0) return '—';
    return `₹${(amt / form.splitAmong.length).toFixed(2)}`;
  };

  const handleAddExpense = () => {
    const amount = parseFloat(form.amount);
    if (!form.title.trim() || !amount || form.splitAmong.length === 0) return;

    let splits = {};
    if (form.splitType === 'equal') {
      const share = amount / form.splitAmong.length;
      form.splitAmong.forEach((m) => {
        splits[m] = share;
      });
    } else {
      splits = { ...form.customSplits };
    }

    setExpenses((prev) => [
      ...prev,
      {
        id: Date.now(),
        title: form.title.trim(),
        amount,
        category: form.category,
        paidBy: form.paidBy,
        splitAmong: [...form.splitAmong],
        splits,
        date: new Date().toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
      },
    ]);

    setShowForm(false);
    setView('expenses');
  };

  const deleteExpense = (id) => setExpenses((prev) => prev.filter((e) => e.id !== id));

  const balances = useMemo(() => {
    const bal = {};
    members.forEach((m) => {
      bal[m] = 0;
    });

    expenses.forEach((exp) => {
      bal[exp.paidBy] = (bal[exp.paidBy] || 0) + exp.amount;
      Object.entries(exp.splits).forEach(([member, share]) => {
        if (bal[member] !== undefined) bal[member] -= share;
      });
    });

    return bal;
  }, [expenses, members]);

  const settlements = useMemo(() => simplifyDebts(balances), [balances]);
  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);
  const perPerson = members.length ? totalSpent / members.length : 0;
  const youBalance = balances['You'] ?? 0;

  const grouped = useMemo(() => groupByDate(expenses), [expenses]);

  return (
    <div className="max-w-xl mx-auto">
      {/* Splitwise-style summary header */}
      <div
        className="rounded-t-2xl px-5 py-5 text-white shadow-md"
        style={{ background: `linear-gradient(135deg, ${SW.green} 0%, ${SW.greenDark} 100%)` }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider opacity-90 flex items-center gap-1">
              <Wallet className="w-3.5 h-3.5" /> Trip group total
            </p>
            <p className="text-3xl font-bold mt-1 tabular-nums">₹{totalSpent.toLocaleString('en-IN')}</p>
            <p className="text-sm opacity-90 mt-0.5">
              ~₹{Math.round(perPerson).toLocaleString('en-IN')} / person · {members.length} people 👥
            </p>
          </div>
          <div className="text-right text-sm bg-white/15 rounded-xl px-3 py-2 backdrop-blur-sm">
            <p className="opacity-80 text-xs">Your balance</p>
            <p className="font-bold text-lg tabular-nums">
              {youBalance > 0.01 && `+₹${Math.abs(youBalance).toFixed(0)}`}
              {youBalance < -0.01 && `-₹${Math.abs(youBalance).toFixed(0)}`}
              {Math.abs(youBalance) <= 0.01 && '✓ Even'}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1a1a1a] border border-t-0 border-slate-200 dark:border-slate-700 rounded-b-2xl shadow-lg overflow-hidden">
        {/* Members strip */}
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Friends in group 🙌
            </span>
          </div>
          <div className="flex flex-wrap gap-2 mb-2">
            {members.map((m, i) => (
              <div
                key={m}
                className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-full pl-1 pr-2 py-1 text-xs font-medium text-slate-800 dark:text-slate-100 shadow-sm"
              >
                <div
                  className={`w-6 h-6 rounded-full ${getAvatarColor(i)} flex items-center justify-center text-white text-[10px] font-bold`}
                >
                  {m[0].toUpperCase()}
                </div>
                {m}
                {m !== 'You' && (
                  <button
                    type="button"
                    onClick={() => removeMember(m)}
                    className="text-slate-300 hover:text-red-400 ml-0.5"
                    title={`Remove ${m}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newMember}
              onChange={(e) => setNewMember(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addMember()}
              placeholder="Add friend…"
              className="flex-1 px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400"
            />
            <button
              type="button"
              onClick={addMember}
              className="px-4 py-2 text-sm font-semibold text-white rounded-lg shrink-0"
              style={{ backgroundColor: SW.green }}
            >
              Add
            </button>
          </div>
        </div>

        {/* Tabs */}
        {expenses.length > 0 && (
          <div className="flex p-1.5 mx-3 mt-3 mb-1 bg-slate-100 dark:bg-slate-800 rounded-xl gap-1">
            {[
              { id: 'expenses', label: '⚡ Expenses' },
              { id: 'balances', label: '💚 Settle up' },
            ].map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setView(v.id)}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                  view === v.id
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        )}

        {/* Add expense CTA */}
        {!showForm && (
          <div className="p-4 pb-2">
            <button
              type="button"
              onClick={openForm}
              className="w-full py-3.5 rounded-xl font-bold text-white shadow-md flex items-center justify-center gap-2 text-sm active:scale-[0.99] transition-transform"
              style={{ backgroundColor: SW.green }}
            >
              <Plus className="w-5 h-5" />
              Add an expense
            </button>
          </div>
        )}

        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-3 mb-3 p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-600 rounded-xl space-y-3"
          >
            <div className="flex justify-between items-center">
              <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm">
                <Receipt className="w-4 h-4" style={{ color: SW.green }} />
                New expense ✨
              </h4>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Dinner, cab, tickets… 🍽️"
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white"
            />

            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">₹</span>
                <input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0"
                  min="0"
                  className="w-full pl-7 pr-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg text-sm"
                />
              </div>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="px-2 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emoji} {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase mb-1.5">Paid by 💳</p>
              <div className="flex flex-wrap gap-1.5">
                {members.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setForm({ ...form, paidBy: m })}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                      form.paidBy === m
                        ? 'text-white shadow'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                    }`}
                    style={form.paidBy === m ? { backgroundColor: SW.green } : {}}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase mb-1.5">Split between ✂️</p>
              <div className="flex flex-wrap gap-1.5">
                {members.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => toggleSplitMember(m)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1 ${
                      form.splitAmong.includes(m)
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {form.splitAmong.includes(m) && <Check className="w-3 h-3" />}
                    {m}
                  </button>
                ))}
              </div>
              {form.splitAmong.length > 0 && form.amount && (
                <p className="text-xs text-slate-500 mt-1">
                  {equalShare()} each · {form.splitAmong.length} people 🎯
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={handleAddExpense}
              disabled={!form.title.trim() || !form.amount || form.splitAmong.length === 0}
              className="w-full py-2.5 rounded-xl font-bold text-white disabled:opacity-40 text-sm"
              style={{ backgroundColor: SW.green }}
            >
              Save expense
            </button>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {view === 'expenses' && (
            <motion.div
              key="expenses"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-3 pb-4 max-h-[420px] overflow-y-auto"
            >
              {expenses.length === 0 ? (
                <EmptyState />
              ) : (
                Object.entries(grouped).map(([dateLabel, list]) => (
                  <div key={dateLabel} className="mb-4">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1 mb-2">
                      📅 {dateLabel}
                    </p>
                    <div className="space-y-2">
                      {list.map((exp) => {
                        const cat = CATEGORIES.find((c) => c.id === exp.category);
                        return (
                          <motion.div
                            key={exp.id}
                            initial={{ opacity: 0, x: -6 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700 group"
                          >
                            <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 flex items-center justify-center text-2xl shrink-0">
                              {cat?.emoji}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-slate-900 dark:text-white truncate text-sm">{exp.title}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {exp.paidBy} paid · split {exp.splitAmong.length} ways
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="font-bold text-slate-900 dark:text-white text-sm tabular-nums">
                                ₹{exp.amount.toLocaleString('en-IN')}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                ₹{(exp.amount / exp.splitAmong.length).toFixed(0)}/ea
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => deleteExpense(exp.id)}
                              className="text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          )}

          {view === 'balances' && (
            <motion.div
              key="balances"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-3 pb-4 space-y-4"
            >
              <div className="space-y-2">
                <h4 className="text-[11px] font-bold text-slate-500 uppercase px-1">Balances 💰</h4>
                <div className="space-y-2">
                  {members.map((m, i) => {
                    const bal = balances[m] || 0;
                    const isOwed = bal > 0.01;
                    const owes = bal < -0.01;
                    return (
                      <div
                        key={m}
                        className={`p-3 rounded-xl border flex items-center gap-3 ${
                          isOwed
                            ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900'
                            : owes
                            ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-100 dark:border-rose-900'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700'
                        }`}
                      >
                        <div
                          className={`w-10 h-10 rounded-full ${getAvatarColor(i)} flex items-center justify-center text-white font-bold text-sm shrink-0`}
                        >
                          {m[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-white text-sm truncate">{m}</p>
                          <p
                            className={`text-xs font-medium ${
                              isOwed ? 'text-emerald-600 dark:text-emerald-400' : owes ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'
                            }`}
                          >
                            {isOwed && `gets back ₹${Math.abs(bal).toFixed(0)}`}
                            {owes && `owes ₹${Math.abs(bal).toFixed(0)}`}
                            {!isOwed && !owes && 'settled ✓'}
                          </p>
                        </div>
                        <span
                          className={`font-bold tabular-nums ${
                            isOwed ? 'text-emerald-600' : owes ? 'text-rose-500' : 'text-slate-400'
                          }`}
                        >
                          {isOwed ? '+' : owes ? '-' : ''}₹{Math.abs(bal).toFixed(0)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {settlements.length > 0 ? (
                <div className="space-y-2">
                  <h4 className="text-[11px] font-bold text-slate-500 uppercase px-1 flex items-center gap-2">
                    Simplify debts 🔄
                  </h4>
                  {settlements.map((s, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      className="flex items-center gap-2 p-3 rounded-xl bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-950/40 dark:to-cyan-950/30 border border-teal-100 dark:border-teal-900"
                    >
                      <div
                        className={`w-9 h-9 rounded-full ${getAvatarColor(members.indexOf(s.from))} flex items-center justify-center text-white text-xs font-bold shrink-0`}
                      >
                        {s.from[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0 text-sm">
                        <span className="text-rose-600 dark:text-rose-400 font-semibold">{s.from}</span>
                        <span className="text-slate-500 mx-1">→</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{s.to}</span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
                      <div
                        className={`w-9 h-9 rounded-full ${getAvatarColor(members.indexOf(s.to))} flex items-center justify-center text-white text-xs font-bold shrink-0`}
                      >
                        {s.to[0].toUpperCase()}
                      </div>
                      <span className="font-bold text-slate-900 dark:text-white tabular-nums text-sm shrink-0">
                        ₹{s.amount.toLocaleString('en-IN')}
                      </span>
                    </motion.div>
                  ))}
                </div>
              ) : (
                expenses.length > 0 && (
                  <div className="text-center py-6 text-[#1CC29F]">
                    <Check className="w-10 h-10 mx-auto mb-2 opacity-70" />
                    <p className="font-bold">All settled up! 🎉</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">No transfers needed.</p>
                  </div>
                )
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
