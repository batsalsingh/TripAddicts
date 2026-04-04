import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import ExpenseSplitter from '../components/ExpenseSplitter.jsx';

export default function SplitterPage() {
  return (
    <div className="min-h-screen bg-[#ececec] dark:bg-[#0b1120]">
      <div className="bg-white/90 dark:bg-[#151d32]/95 border-b border-slate-200 dark:border-slate-800 py-8 px-4">
        <div className="max-w-xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-[#1CC29F] dark:hover:text-[#1CC29F] mb-4 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to home
            </Link>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              💚 Split expenses
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-sm md:text-base">
              Splitwise-style balances, settle-up suggestions, and shared trip costs — all in one place ✨
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 sm:px-6 py-8">
        <ExpenseSplitter />
      </div>
    </div>
  );
}
