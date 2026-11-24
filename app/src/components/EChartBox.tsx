"use client";

import React, { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import * as echarts from "echarts";
import type { EChartsOption, ECharts } from "echarts";

export interface EChartBoxHandle {
  exportPng: (filename: string) => void;
}

interface EChartBoxProps {
  option: EChartsOption;
  height?: number | string;
  className?: string;
  ariaLabel?: string;
  onPointClick?: (params: unknown) => void;
}

export const EChartBox = forwardRef<EChartBoxHandle, EChartBoxProps>(
  function EChartBox({ option, height = 380, className = "", ariaLabel, onPointClick }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<ECharts | null>(null);

    useImperativeHandle(ref, () => ({
      exportPng(filename: string) {
        if (!chartRef.current) return;
        const url = chartRef.current.getDataURL({
          type: "png",
          pixelRatio: 2,
          backgroundColor: "#ffffff",
        });
        const a = document.createElement("a");
        a.href = url;
        a.download = filename.endsWith(".png") ? filename : `${filename}.png`;
        a.click();
      },
    }));

    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const chart = echarts.init(el, undefined, { renderer: "canvas" });
      chartRef.current = chart;

      const ro = new ResizeObserver(() => {
        chart.resize();
      });
      ro.observe(el);

      return () => {
        ro.disconnect();
        chart.dispose();
        chartRef.current = null;
      };
    }, []);

    useEffect(() => {
      const chart = chartRef.current;
      if (!chart) return;
      chart.setOption(option, { notMerge: true });
    }, [option]);

    useEffect(() => {
      const chart = chartRef.current;
      if (!chart || !onPointClick) return;
      chart.off("click");
      chart.on("click", onPointClick);
      return () => {
        chart.off("click");
      };
    }, [onPointClick]);

    return (
      <div
        ref={containerRef}
        role="img"
        aria-label={ariaLabel || "数据可视化图表"}
        style={{ height: typeof height === "number" ? `${height}px` : height, width: "100%" }}
        className={className}
      />
    );
  }
);
