import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Luggage } from 'lucide-react';
import { getPreTripChecklist, savePreTripChecklist } from '../utils/localTravelData.js';

const ITEMS = [
  { id: 'id', label: 'Valid ID / passport 📇' },
  { id: 'bookings', label: 'Tickets & hotel confirmations 📧' },
  { id: 'insurance', label: 'Travel insurance (if needed) 🛡️' },
  { id: 'meds', label: 'Medications & first aid 💊' },
  { id: 'power', label: 'Chargers & adapters 🔌' },
  { id: 'cash', label: 'Cash / cards & notify bank 💳' },
  { id: 'weather', label: 'Weather-appropriate clothes 🧥' },
  { id: 'offline', label: 'Offline maps / downloads 📱' },
];

export default function PreTripChecklist() {
  const [open, setOpen] = useState(true);
  const [done, setDone] = useState(() => getPreTripChecklist());

  useEffect(() => {
    savePreTripChecklist(done);
  }, [done]);

  const total = ITEMS.length;
  const checked = ITEMS.filter((i) => done[i.id]).length;

  const toggle = (id) => {
    setDone((d) => ({ ...d, [id]: !d[id] }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm"
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 dark:hover:bg-gray-800/80 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/15 flex items-center justify-center">
            <Luggage className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-white text-sm">Pre-trip checklist</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {checked}/{total} packed · saved on this device ✓
            </p>
          </div>
        </div>
        <div className="text-slate-400">
          {open ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-slate-100 dark:border-gray-800"
          >
            <ul className="p-3 space-y-1.5">
              {ITEMS.map((item) => (
                <li key={item.id}>
                  <label className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-gray-800/50">
                    <input
                      type="checkbox"
                      checked={!!done[item.id]}
                      onChange={() => toggle(item.id)}
                      className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                    />
                    <span
                      className={`text-sm ${
                        done[item.id] ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {item.label}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
