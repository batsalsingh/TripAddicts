import React from 'react';

/** TripAddicts mark: route path on a sunrise gradient — works in light & dark nav */
export function TripAddictsMark({ className = 'w-9 h-9' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="taLogoGrad" x1="6" y1="4" x2="36" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor="#06b6d4" />
          <stop offset="0.45" stopColor="#0ea5e9" />
          <stop offset="1" stopColor="#ea580c" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#taLogoGrad)" />
      <path
        d="M10 26c4-10 8-14 12-14s6 4 10 14"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.35"
      />
      <path
        d="M9 27 L15 13 L21 20 L27 11 L31 24"
        stroke="white"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="15" cy="13" r="2.6" fill="white" />
      <circle cx="31" cy="24" r="2.6" fill="white" />
      <path
        d="M26 8 L29 11 L26 14"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity="0.9"
      />
    </svg>
  );
}

export function TripAddictsWordmark({ className = '' }) {
  return (
    <span className={`font-bold text-slate-900 dark:text-white tracking-tight ${className}`}>
      <span className="text-slate-900 dark:text-white">Trip</span>
      <span className="bg-gradient-to-r from-cyan-500 via-sky-500 to-orange-500 bg-clip-text text-transparent">
        Addicts
      </span>
    </span>
  );
}
