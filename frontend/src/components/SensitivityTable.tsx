import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SensitivityTableProps {
  index: number[];
  columns: number[];
  data: (number | null)[][];
  currentPrice: number;
}

export const SensitivityTable: React.FC<SensitivityTableProps> = ({ index, columns, data, currentPrice }) => {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950/50 p-4 font-mono text-xs">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-zinc-500 uppercase tracking-widest">WACC vs TGR Sensitivity</span>
        <div className="flex gap-4">
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
            <span className="text-zinc-400">Upside</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-rose-500"></div>
            <span className="text-zinc-400">Downside</span>
          </div>
        </div>
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="border-b border-r border-zinc-800 p-2 text-left text-zinc-500 bg-zinc-900/50">TGR \ WACC</th>
            {columns.map((wacc) => (
              <th key={wacc} className="border-b border-zinc-800 p-2 text-center text-zinc-400 bg-zinc-900/50">
                {(wacc * 100).toFixed(1)}%
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {index.map((tgr, i) => (
            <tr key={tgr} className="hover:bg-zinc-900/30 transition-colors">
              <td className="border-r border-zinc-800 p-2 text-left text-zinc-400 font-bold bg-zinc-900/20">
                {(tgr * 100).toFixed(1)}%
              </td>
              {data[i].map((val, j) => {
                const isUpside = val !== null && val > currentPrice;
                const isBase = i === 1 && j === 2; // Assuming 0-indexed center is base if 3x5 table? 
                // Wait, index is usually TGR, columns is WACC.
                
                return (
                  <td
                    key={`${i}-${j}`}
                    className={cn(
                      "border border-zinc-900 p-2 text-center transition-all duration-300",
                      val === null ? "text-zinc-700 font-normal" : isUpside ? "text-emerald-400 font-medium" : "text-rose-400 font-medium",
                      isBase && " ring-1 ring-inset ring-white rounded-sm bg-zinc-800/50"
                    )}
                  >
                    {val !== null ? `$${val.toFixed(2)}` : '--'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
