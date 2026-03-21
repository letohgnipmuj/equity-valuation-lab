"use client";

import React, { useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import { DCFModel } from "@/contexts/ValuationContext";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
import { downloadFile } from "@/lib/download";

interface DCFViewProps {
  dcf: DCFModel;
  currentPrice?: number;
  ticker: string;
}

export function DCFView({ dcf, currentPrice, ticker }: DCFViewProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (!ticker) return;
    try {
      setIsDownloading(true);
      await downloadFile(
        `${API_BASE_URL}/api/exports/dcf/${ticker}`,
        `${ticker} DCF.xlsx`
      );
    } catch (err) {
      console.error(err);
    } finally {
      setIsDownloading(false);
    }
  };

  // Memoize ECharts configuration so it doesn't re-render excessively
  const chartOptions = useMemo(() => {
    if (!dcf.sensitivity || !dcf.sensitivity.index || !dcf.sensitivity.columns || !dcf.sensitivity.data) return null;

    const yAxisData = dcf.sensitivity.index.map((val: number) => `${(val * 100).toFixed(1)}%`); // TGR
    const xAxisData = dcf.sensitivity.columns.map((val: number) => `${(val * 100).toFixed(1)}%`); // WACC

    const data: [number, number, number | string][] = [];
    let minVal = Infinity;
    let maxVal = -Infinity;

    dcf.sensitivity.data.forEach((row: any[], yIdx: number) => {
      row.forEach((val, xIdx) => {
        const v = typeof val === 'number' ? val : parseFloat(val);
        if (!isNaN(v)) {
          data.push([xIdx, yIdx, v]);
          if (v < minVal) minVal = v;
          if (v > maxVal) maxVal = v;
        } else {
          data.push([xIdx, yIdx, "-"]);
        }
      });
    });

    return {
      tooltip: {
        position: 'top',
        formatter: function (params: any) {
          const tgr = yAxisData[params.value[1]];
          const wacc = xAxisData[params.value[0]];
          const val = typeof params.value[2] === 'number' ? `$${params.value[2].toFixed(2)}` : 'N/A';
          return `TGR: ${tgr}<br/>WACC: ${wacc}<br/>Implied: <b style="color:white">${val}</b>`;
        },
        backgroundColor: 'rgba(20,20,20,0.85)',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#fff' }
      },
      grid: {
        top: 10,
        bottom: 40,
        left: 60,
        right: 20
      },
      xAxis: {
        type: 'category',
        data: xAxisData,
        splitArea: { show: true },
        axisLabel: { color: 'rgba(255,255,255,0.6)' },
        name: 'WACC',
        nameLocation: 'middle',
        nameGap: 35,
        nameTextStyle: { color: 'rgba(255,255,255,0.8)' }
      },
      yAxis: {
        type: 'category',
        data: yAxisData,
        splitArea: { show: true },
        axisLabel: { color: 'rgba(255,255,255,0.6)' },
        name: 'TGR',
        nameLocation: 'middle',
        nameGap: 45,
        nameTextStyle: { color: 'rgba(255,255,255,0.8)' }
      },
      visualMap: {
        min: minVal === Infinity ? 0 : minVal,
        max: maxVal === -Infinity ? 10 : maxVal,
        show: false,
        inRange: {
          color: ['rgba(255,0,0,0.4)', 'rgba(50,50,50,0.6)', 'rgba(0,255,100,0.4)']
        }
      },
      series: [{
        name: 'Sensitivity',
        type: 'heatmap',
        data: data,
        label: {
          show: true,
          formatter: function (p: any) {
            if (typeof p.value[2] === 'number') {
              return `$${p.value[2].toFixed(2)}`;
            }
            return '--';
          },
          color: '#fff'
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }]
    };
  }, [dcf]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-6">
          <div>
            <h3 className="text-xl tracking-tight font-medium text-white/90">Discounted Cash Flow</h3>
            <p className="text-sm text-white/50 mt-1 mb-6">Implied fair value based on estimated future cash flows.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={isDownloading}
            className="border-white/20 bg-white/5 text-white hover:bg-white/10"
          >
            <Download className="w-4 h-4" />
            {isDownloading ? "Exporting..." : "Export DCF"}
          </Button>
        </div>

        <div className="glass p-6 rounded-2xl flex items-center justify-between border-white/5">
          <div className="flex flex-col">
            <span className="text-sm text-white/50 uppercase tracking-widest font-semibold mb-1">DCF Output</span>
            <span className="text-4xl font-mono text-white">${dcf.implied_price.toFixed(2)}</span>
          </div>

          {currentPrice && (
            <div className="flex flex-col items-end">
              <span className="text-sm text-white/50 uppercase tracking-widest font-semibold mb-1">Upside</span>
              <span className={`text-2xl font-mono ${((dcf.implied_price - currentPrice) / currentPrice) * 100 > 0 ? "text-green-400" : "text-red-400"}`}>
                {(((dcf.implied_price - currentPrice) / currentPrice) * 100).toFixed(2)}%
              </span>
            </div>
          )}
        </div>

        {dcf.assumptions && (
          <div className="grid grid-cols-2 gap-4">
            <div className="glass p-4 rounded-xl border-white/5 flex flex-col justify-center">
              <span className="text-xs text-white/40 uppercase font-bold tracking-wider mb-2">Discount Rate (WACC)</span>
              <span className="text-xl font-mono text-white/80 bg-white/10 p-2 rounded">{dcf.wacc ? (dcf.wacc * 100).toFixed(2) : '-'}%</span>
            </div>
            <div className="glass p-4 rounded-xl border-white/5 flex flex-col justify-center">
              <span className="text-xs text-white/40 uppercase font-bold tracking-wider mb-2">Terminal Growth (TGR)</span>
              <span className="text-xl font-mono text-white/80 bg-white/10 p-2 rounded">{dcf.tgr ? (dcf.tgr * 100).toFixed(2) : '-'}%</span>
            </div>
          </div>
        )}
      </div>

      <div className="glass p-6 rounded-2xl border-white/5 h-full min-h-[450px] flex flex-col">
        <h4 className="text-sm font-semibold tracking-wider text-white/40 uppercase mb-6 text-center">Sensitivity Matrix</h4>

        {chartOptions ? (
          <div className="flex-1 w-full min-h-[300px]">
            <ReactECharts option={chartOptions} style={{ height: '100%', width: '100%' }} />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center opacity-40">
            <p>Sensitivity data unavailable</p>
          </div>
        )}
      </div>
    </div>
  );
}
