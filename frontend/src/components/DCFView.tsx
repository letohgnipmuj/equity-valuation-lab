"use client";

import React, { useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import { DCFModel } from "@/contexts/ValuationContext";
import { Button } from "@/components/ui/button";
import { Download, Info } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
import { downloadFile } from "@/lib/download";

interface DCFViewProps {
  dcf: DCFModel;
  currentPrice?: number;
  ticker: string;
  scenarioLabel?: string;
  scenarioWacc?: number;
  scenarioTgr?: number;
  scenarioWaccDelta?: number;
  scenarioTgrDelta?: number;
  scenarioImpliedPrice?: number;
}

export function DCFView({
  dcf,
  currentPrice,
  ticker,
  scenarioLabel,
  scenarioWacc,
  scenarioTgr,
  scenarioWaccDelta,
  scenarioTgrDelta,
  scenarioImpliedPrice,
}: DCFViewProps) {
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

    const data: Array<[number, number, number | string] | { value: [number, number, number | string]; itemStyle: { borderColor: string; borderWidth: number } }> = [];
    let minVal = Infinity;
    let maxVal = -Infinity;

    const getNearestIndex = (values: number[], target: number) => {
      let bestIdx = 0;
      let bestDiff = Infinity;
      values.forEach((val, idx) => {
        const diff = Math.abs(val - target);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestIdx = idx;
        }
      });
      return bestIdx;
    };

    let highlightPoint: [number, number] | null = null;
    if (scenarioWacc !== undefined && scenarioTgr !== undefined) {
      const tgrIndex = getNearestIndex(dcf.sensitivity.index, scenarioTgr);
      const waccIndex = getNearestIndex(dcf.sensitivity.columns, scenarioWacc);
      highlightPoint = [waccIndex, tgrIndex];
    }

    dcf.sensitivity.data.forEach((row: any[], yIdx: number) => {
      row.forEach((val, xIdx) => {
        const v = typeof val === 'number' ? val : parseFloat(val);
        const isHighlight = highlightPoint && highlightPoint[0] === xIdx && highlightPoint[1] === yIdx;
        if (!isNaN(v)) {
          if (isHighlight) {
            data.push({
              value: [xIdx, yIdx, v],
              itemStyle: {
                borderColor: 'rgba(255,255,255,0.9)',
                borderWidth: 2
              }
            });
          } else {
            data.push([xIdx, yIdx, v]);
          }
          if (v < minVal) minVal = v;
          if (v > maxVal) maxVal = v;
        } else {
          if (isHighlight) {
            data.push({
              value: [xIdx, yIdx, "-"],
              itemStyle: {
                borderColor: 'rgba(255,255,255,0.9)',
                borderWidth: 2
              }
            });
          } else {
            data.push([xIdx, yIdx, "-"]);
          }
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
        },
      }]
    };
  }, [dcf, scenarioTgr, scenarioWacc]);

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
            <span className="text-5xl font-mono text-white">
              ${((typeof scenarioImpliedPrice === "number" ? scenarioImpliedPrice : dcf.implied_price) || 0).toFixed(2)}
            </span>
            {scenarioLabel && (
              <span className="mt-2 text-xs text-white/50 uppercase tracking-widest font-semibold">
                {scenarioLabel} case
              </span>
            )}
          </div>

          {currentPrice && (
            <div className="flex flex-col items-end">
              <span className="text-sm text-white/50 uppercase tracking-widest font-semibold mb-1">Upside</span>
              <span className={`text-2xl font-mono ${(((typeof scenarioImpliedPrice === "number" ? scenarioImpliedPrice : dcf.implied_price) - currentPrice) / currentPrice) * 100 > 0 ? "text-green-400" : "text-red-400"}`}>
                {((((typeof scenarioImpliedPrice === "number" ? scenarioImpliedPrice : dcf.implied_price) - currentPrice) / currentPrice) * 100).toFixed(2)}%
              </span>
            </div>
          )}
        </div>

        {dcf.assumptions && (
          <div className="grid grid-cols-2 gap-4">
            <div className="glass p-4 rounded-xl border-white/5 flex flex-col justify-center overflow-visible">
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/40 uppercase font-bold tracking-wider">Discount Rate (WACC)</span>
                <div className="relative group">
                  <Info className="w-3.5 h-3.5 text-white/40 hover:text-white" />
                  <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all duration-200 absolute -top-14 left-1/2 -translate-x-1/2 w-72 bg-slate-900 text-xxs text-white p-2 rounded-lg shadow-lg z-50">
                    WACC: Weighted cost of equity (expected return via CAPM) and cost of debt (interest).
                  </div>
                </div>
              </div>
              <span className="text-xl font-mono text-white/80 bg-white/10 p-2 rounded">
                {dcf.wacc ? (dcf.wacc * 100).toFixed(2) : "-"}%
                {scenarioWaccDelta !== undefined && (
                  <span className="ml-2 text-sm text-white/40">
                    ({scenarioWaccDelta >= 0 ? "+" : ""}{(scenarioWaccDelta * 100).toFixed(2)}%)
                  </span>
                )}
              </span>
            </div>
            <div className="glass p-4 rounded-xl border-white/5 flex flex-col justify-center overflow-visible">
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/40 uppercase font-bold tracking-wider">Terminal Growth (TGR)</span>
                <div className="relative group">
                  <Info className="w-3.5 h-3.5 text-white/40 hover:text-white" />
                  <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all duration-200 absolute -top-14 left-1/2 -translate-x-1/2 w-72 bg-slate-900 text-xxs text-white p-2 rounded-lg shadow-lg z-50">
                    TGR: Assumed growth rate of the company into perpetuity, calculated as ROIC * reinvestment rate.
                  </div>
                </div>
              </div>
              <span className="text-xl font-mono text-white/80 bg-white/10 p-2 rounded">
                {dcf.tgr ? (dcf.tgr * 100).toFixed(2) : "-"}%
                {scenarioTgrDelta !== undefined && (
                  <span className="ml-2 text-sm text-white/40">
                    ({scenarioTgrDelta >= 0 ? "+" : ""}{(scenarioTgrDelta * 100).toFixed(2)}%)
                  </span>
                )}
              </span>
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
