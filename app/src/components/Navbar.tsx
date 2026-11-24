"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search, X, Globe, BarChart3, BookOpen, Compass, Menu } from "lucide-react";
import { useLang } from "./LanguageContext";
import { INDICATOR_ALIASES, formatValue } from "@/lib/format";
import type { IndicatorSummary, RegionRecord } from "@/lib/types";

interface NavbarProps {
  indicators: IndicatorSummary[];
  regions: RegionRecord[];
}

export function Navbar({ indicators, regions }: NavbarProps) {
  const { lang, setLang, t } = useLang();
  const pathname = usePathname();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [searchOpen]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      } else if (e.key === "Escape") {
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return {
        indicators: indicators.slice(0, 6),
        provinces: [] as RegionRecord[],
      };
    }
    const matchedInds = indicators.filter((ind) => {
      const aliases = INDICATOR_ALIASES[ind.indicator_id] || [];
      return (
        ind.indicator_name_zh.toLowerCase().includes(q) ||
        ind.indicator_name_en.toLowerCase().includes(q) ||
        ind.category_zh.toLowerCase().includes(q) ||
        ind.category_en.toLowerCase().includes(q) ||
        ind.indicator_id.toLowerCase().includes(q) ||
        aliases.some((a) => a.toLowerCase().includes(q))
      );
    });
    const matchedProvs = regions.filter(
      (r) =>
        r.geo_level === "provincial" &&
        r.in_mainland_nbs_scope === "true" &&
        (r.geo_name_zh.toLowerCase().includes(q) ||
          r.geo_name_short_zh.toLowerCase().includes(q) ||
          r.geo_name_en.toLowerCase().includes(q) ||
          r.region_name_zh.toLowerCase().includes(q))
    );
    return {
      indicators: matchedInds.slice(0, 8),
      provinces: matchedProvs.slice(0, 6),
    };
  }, [query, indicators, regions]);

  const navItems = [
    { href: "/", label: t("首页", "Home"), icon: Compass },
    { href: "/#indicators", label: t("核心指标", "Indicators"), icon: BarChart3 },
    { href: "/explore", label: t("跨指标探索", "Explorer"), icon: BarChart3 },
    { href: "/methodology", label: t("方法与合规", "Methodology"), icon: BookOpen },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[#e5e7eb] bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6 min-w-0">
            <Link
              href="/"
              className="flex items-center gap-2.5 text-[#1e3a5f] hover:opacity-90 shrink-0"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#1e3a5f] text-sm font-bold text-white tracking-tight">
                数
              </span>
              <div className="leading-tight">
                <div className="text-base font-bold tracking-tight text-[#111827]">
                  {t("中国数据地图", "China Data Atlas")}
                </div>
                <div className="hidden sm:block text-[11px] font-medium tracking-wide text-[#6b7280]">
                  {t("CHINA DATA ATLAS · 官方统计研究平台", "Official Statistical Research Platform")}
                </div>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-1" aria-label="主导航">
              {navItems.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : item.href.startsWith("/#")
                      ? false
                      : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "bg-[#1e3a5f]/10 text-[#1e3a5f]"
                        : "text-[#4b5563] hover:bg-gray-100 hover:text-[#111827]"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              data-testid="global-search-trigger"
              aria-label={t("全站搜索指标或省份", "Search indicators or provinces")}
              className="flex items-center gap-2 rounded-lg border border-[#d1d5db] bg-[#fafaf8] px-3 py-1.5 text-sm text-[#4b5563] hover:border-[#1e3a5f] hover:text-[#111827] transition-colors"
            >
              <Search className="h-4 w-4 shrink-0 text-[#6b7280]" />
              <span className="hidden sm:inline">{t("搜索指标、GDP、广东...", "Search indicators, GDP...")}</span>
              <span className="sm:hidden">{t("搜索", "Search")}</span>
              <kbd className="hidden lg:inline-block rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[11px] font-mono text-gray-500">
                ⌘K
              </kbd>
            </button>

            <button
              type="button"
              onClick={() => setLang(lang === "zh" ? "en" : "zh")}
              data-testid="lang-toggle"
              aria-label="Toggle language"
              className="flex items-center gap-1 rounded-lg border border-[#e5e7eb] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#1e3a5f] hover:bg-gray-50"
            >
              <Globe className="h-3.5 w-3.5" />
              <span>{lang === "zh" ? "EN" : "中文"}</span>
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label={t("打开菜单", "Toggle menu")}
              className="md:hidden rounded-lg border border-[#e5e7eb] p-1.5 text-[#374151] hover:bg-gray-50"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#e5e7eb] bg-white px-4 py-3 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block rounded-md px-3 py-2 text-sm font-medium text-[#374151] hover:bg-gray-100"
              >
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </header>

      {searchOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-16 sm:pt-24 backdrop-blur-[1px]"
          onClick={() => setSearchOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("全站数据搜索", "Global Data Search")}
            className="w-full max-w-2xl overflow-hidden rounded-xl border border-[#e5e7eb] bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-[#e5e7eb] px-4 py-3">
              <Search className="h-5 w-5 text-[#1e3a5f]" />
              <input
                ref={inputRef}
                type="text"
                data-testid="global-search-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t(
                  "输入指标名、同义词（如 老龄化、GDP、医生、大学）或省份名（如 广东）...",
                  "Type indicator, synonym (GDP, aging, doctors), or province (Guangdong)..."
                )}
                className="w-full bg-transparent text-sm text-[#111827] placeholder-[#9ca3af] focus:outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="text-xs text-[#6b7280] hover:text-[#111827]"
                >
                  {t("清除", "Clear")}
                </button>
              )}
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                aria-label={t("关闭搜索", "Close search")}
                className="rounded p-1 text-[#6b7280] hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[65vh] overflow-y-auto p-3 space-y-4">
              {searchResults.indicators.length > 0 && (
                <div>
                  <div className="px-2 pb-1.5 text-xs font-semibold uppercase tracking-wider text-[#6b7280]">
                    {t("统计指标", "Indicators")} ({searchResults.indicators.length})
                  </div>
                  <div className="space-y-1">
                    {searchResults.indicators.map((ind) => (
                      <button
                        key={ind.indicator_id}
                        type="button"
                        onClick={() => {
                          setSearchOpen(false);
                          setQuery("");
                          router.push(`/indicators/${ind.indicator_id}`);
                        }}
                        className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-[#fafaf8] transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[#111827] truncate">
                            {lang === "zh" ? ind.indicator_name_zh : ind.indicator_name_en}
                          </div>
                          <div className="text-xs text-[#6b7280] truncate">
                            {lang === "zh" ? ind.category_zh : ind.category_en} · {ind.unit} ·{" "}
                            {t("最新省级", "Latest Prov")}: {ind.latest_provincial_year ?? "—"}
                          </div>
                        </div>
                        {ind.latest_national && (
                          <div className="text-right shrink-0 tabular-nums">
                            <div className="text-sm font-semibold text-[#1e3a5f]">
                              {formatValue(ind.latest_national.value, ind.precision)}
                            </div>
                            <div className="text-[11px] text-[#6b7280]">
                              {t("全国", "CN")} {ind.latest_national.year}
                            </div>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {searchResults.provinces.length > 0 && (
                <div>
                  <div className="px-2 pb-1.5 text-xs font-semibold uppercase tracking-wider text-[#6b7280]">
                    {t("直达省份数据（跳转至常住人口并高亮该省）", "Jump to Province")}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {searchResults.provinces.map((prov) => (
                      <button
                        key={prov.geo_code}
                        type="button"
                        onClick={() => {
                          setSearchOpen(false);
                          setQuery("");
                          router.push(`/indicators/population?province=${prov.geo_code}`);
                        }}
                        className="flex items-center justify-between rounded-lg border border-[#e5e7eb] px-3 py-2 text-left text-sm hover:border-[#1e3a5f] hover:bg-[#fafaf8]"
                      >
                        <span className="font-medium text-[#111827]">
                          {lang === "zh" ? prov.geo_name_zh : prov.geo_name_en}
                        </span>
                        <span className="text-xs text-[#6b7280]">
                          {lang === "zh" ? prov.region_name_zh : prov.region_name_en}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {searchResults.indicators.length === 0 && searchResults.provinces.length === 0 && (
                <div className="py-8 text-center text-sm text-[#6b7280]">
                  {t(`未找到与「${query}」匹配的指标或省级行政区`, `No matching indicators or provinces for "${query}"`)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
