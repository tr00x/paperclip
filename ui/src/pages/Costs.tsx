import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { CostByProviderModel, CostWindowSpendRow, QuotaWindow } from "@paperclipai/shared";
import { costsApi } from "../api/costs";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { ProviderQuotaCard } from "../components/ProviderQuotaCard";
import { PageTabBar } from "../components/PageTabBar";
import { formatCents, formatTokens, providerDisplayName } from "../lib/utils";
import { Identity } from "../components/Identity";
import { StatusBadge } from "../components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign } from "lucide-react";
import { useDateRange, PRESET_LABELS, PRESET_KEYS } from "../hooks/useDateRange";

// ---------- helpers ----------

/** current week mon-sun boundaries as iso strings */
function currentWeekRange(): { from: string; to: string } {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun
  const diffToMon = day === 0 ? -6 : 1 - day;
  const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMon, 0, 0, 0, 0);
  const sun = new Date(mon.getTime() + 6 * 24 * 60 * 60 * 1000 + 23 * 3600 * 1000 + 3599 * 1000 + 999);
  return { from: mon.toISOString(), to: sun.toISOString() };
}

function ProviderTabLabel({ provider, rows }: { provider: string; rows: CostByProviderModel[] }) {
  const totalTokens = rows.reduce((s, r) => s + r.inputTokens + r.outputTokens, 0);
  const totalCost = rows.reduce((s, r) => s + r.costCents, 0);
  return (
    <span className="flex items-center gap-1.5">
      <span>{providerDisplayName(provider)}</span>
      <span className="text-xs text-muted-foreground font-mono">{formatTokens(totalTokens)}</span>
      <span className="text-xs text-muted-foreground">{formatCents(totalCost)}</span>
    </span>
  );
}

// ---------- page ----------

export function Costs() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  const [mainTab, setMainTab] = useState<"spend" | "providers">("spend");
  const [activeProvider, setActiveProvider] = useState("all");

  const {
    preset,
    setPreset,
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo,
    from,
    to,
    customReady,
  } = useDateRange();

  useEffect(() => {
    setBreadcrumbs([{ label: "Costs" }]);
  }, [setBreadcrumbs]);

  // key to today's date string so the week range auto-refreshes after midnight on the next render
  const today = new Date().toDateString();
  const weekRange = useMemo(() => currentWeekRange(), [today]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- spend tab queries (no polling — cost data doesn't change in real time) ----------

  const { data: spendData, isLoading: spendLoading, error: spendError } = useQuery({
    queryKey: queryKeys.costs(selectedCompanyId!, from || undefined, to || undefined),
    queryFn: async () => {
      const [summary, byAgent, byProject] = await Promise.all([
        costsApi.summary(selectedCompanyId!, from || undefined, to || undefined),
        costsApi.byAgent(selectedCompanyId!, from || undefined, to || undefined),
        costsApi.byProject(selectedCompanyId!, from || undefined, to || undefined),
      ]);
      return { summary, byAgent, byProject };
    },
    enabled: !!selectedCompanyId && customReady,
  });

  // ---------- providers tab queries (polling — provider quota changes during agent runs) ----------

  const { data: providerData } = useQuery({
    queryKey: queryKeys.usageByProvider(selectedCompanyId!, from || undefined, to || undefined),
    queryFn: () => costsApi.byProvider(selectedCompanyId!, from || undefined, to || undefined),
    enabled: !!selectedCompanyId && customReady,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  const { data: weekData } = useQuery({
    queryKey: queryKeys.usageByProvider(selectedCompanyId!, weekRange.from, weekRange.to),
    queryFn: () => costsApi.byProvider(selectedCompanyId!, weekRange.from, weekRange.to),
    enabled: !!selectedCompanyId,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  const { data: windowData } = useQuery({
    queryKey: queryKeys.usageWindowSpend(selectedCompanyId!),
    queryFn: () => costsApi.windowSpend(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  const { data: quotaData } = useQuery({
    queryKey: queryKeys.usageQuotaWindows(selectedCompanyId!),
    queryFn: () => costsApi.quotaWindows(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    // quota windows come from external provider apis; refresh every 5 minutes
    refetchInterval: 300_000,
    staleTime: 60_000,
  });

  // ---------- providers tab derived maps ----------

  const byProvider = useMemo(() => {
    const map = new Map<string, CostByProviderModel[]>();
    for (const row of providerData ?? []) {
      const arr = map.get(row.provider) ?? [];
      arr.push(row);
      map.set(row.provider, arr);
    }
    return map;
  }, [providerData]);

  const weekSpendByProvider = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of weekData ?? []) {
      map.set(row.provider, (map.get(row.provider) ?? 0) + row.costCents);
    }
    return map;
  }, [weekData]);

  const windowSpendByProvider = useMemo(() => {
    const map = new Map<string, CostWindowSpendRow[]>();
    for (const row of windowData ?? []) {
      const arr = map.get(row.provider) ?? [];
      arr.push(row);
      map.set(row.provider, arr);
    }
    return map;
  }, [windowData]);

  const quotaWindowsByProvider = useMemo(() => {
    const map = new Map<string, QuotaWindow[]>();
    for (const result of quotaData ?? []) {
      if (result.ok && result.windows.length > 0) {
        map.set(result.provider, result.windows);
      }
    }
    return map;
  }, [quotaData]);

  // deficit notch: projected month-end spend vs pro-rata budget share (mtd only)
  // memoized to avoid stale closure reads when summary and byProvider arrive separately
  const deficitNotchByProvider = useMemo(() => {
    const map = new Map<string, boolean>();
    if (preset !== "mtd") return map;
    const budget = spendData?.summary.budgetCents ?? 0;
    if (budget <= 0) return map;
    const totalSpend = spendData?.summary.spendCents ?? 0;
    const now = new Date();
    const daysElapsed = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    for (const [providerKey, rows] of byProvider) {
      const providerCostCents = rows.reduce((s, r) => s + r.costCents, 0);
      const providerShare = totalSpend > 0 ? providerCostCents / totalSpend : 0;
      const providerBudget = budget * providerShare;
      if (providerBudget <= 0) { map.set(providerKey, false); continue; }
      const burnRate = providerCostCents / Math.max(daysElapsed, 1);
      map.set(providerKey, providerCostCents + burnRate * (daysInMonth - daysElapsed) > providerBudget);
    }
    return map;
  }, [preset, spendData, byProvider]);

  const providers = Array.from(byProvider.keys());

  // ---------- guards ----------

  if (!selectedCompanyId) {
    return <EmptyState icon={DollarSign} message="Select a company to view costs." />;
  }

  if (spendLoading) {
    return <PageSkeleton variant="costs" />;
  }

  // ---------- provider tab items ----------

  const providerTabItems = [
    {
      value: "all",
      label: (
        <span className="flex items-center gap-1.5">
          <span>All providers</span>
          {providerData && providerData.length > 0 && (
            <>
              <span className="text-xs text-muted-foreground font-mono">
                {formatTokens(providerData.reduce((s, r) => s + r.inputTokens + r.outputTokens, 0))}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatCents(providerData.reduce((s, r) => s + r.costCents, 0))}
              </span>
            </>
          )}
        </span>
      ),
    },
    ...providers.map((p) => ({
      value: p,
      label: <ProviderTabLabel provider={p} rows={byProvider.get(p)!} />,
    })),
  ];

  // ---------- render ----------

  return (
    <div className="space-y-6">
      {/* date range selector */}
      <div className="flex flex-wrap items-center gap-2">
        {PRESET_KEYS.map((p) => (
          <Button
            key={p}
            variant={preset === p ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setPreset(p)}
          >
            {PRESET_LABELS[p]}
          </Button>
        ))}
        {preset === "custom" && (
          <div className="flex items-center gap-2 ml-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
            />
            <span className="text-sm text-muted-foreground">to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
            />
          </div>
        )}
      </div>

      {/* main spend / providers tab switcher */}
      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as "spend" | "providers")}>
        <TabsList>
          <TabsTrigger value="spend">Spend</TabsTrigger>
          <TabsTrigger value="providers">Providers</TabsTrigger>
        </TabsList>

        {/* ── spend tab ─────────────────────────────────────────────── */}
        <TabsContent value="spend" className="mt-4 space-y-4">
          {spendError && (
            <p className="text-sm text-destructive">{(spendError as Error).message}</p>
          )}

          {preset === "custom" && !customReady ? (
            <p className="text-sm text-muted-foreground">Select a start and end date to load data.</p>
          ) : spendData ? (
            <>
              {/* summary card */}
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">{PRESET_LABELS[preset]}</p>
                    {spendData.summary.budgetCents > 0 && (
                      <p className="text-sm text-muted-foreground">
                        {spendData.summary.utilizationPercent}% utilized
                      </p>
                    )}
                  </div>
                  <p className="text-2xl font-bold">
                    {formatCents(spendData.summary.spendCents)}{" "}
                    <span className="text-base font-normal text-muted-foreground">
                      {spendData.summary.budgetCents > 0
                        ? `/ ${formatCents(spendData.summary.budgetCents)}`
                        : "Unlimited budget"}
                    </span>
                  </p>
                  {spendData.summary.budgetCents > 0 && (
                    <div className="w-full h-2 border border-border overflow-hidden">
                      <div
                        className={`h-full transition-[width,background-color] duration-150 ${
                          spendData.summary.utilizationPercent > 90
                            ? "bg-red-400"
                            : spendData.summary.utilizationPercent > 70
                              ? "bg-yellow-400"
                              : "bg-green-400"
                        }`}
                        style={{ width: `${Math.min(100, spendData.summary.utilizationPercent)}%` }}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* by agent / by project */}
              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <h3 className="text-sm font-semibold mb-3">By Agent</h3>
                    {spendData.byAgent.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No cost events yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {spendData.byAgent.map((row) => (
                          <div
                            key={row.agentId}
                            className="flex items-start justify-between text-sm"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Identity name={row.agentName ?? row.agentId} size="sm" />
                              {row.agentStatus === "terminated" && (
                                <StatusBadge status="terminated" />
                              )}
                            </div>
                            <div className="text-right shrink-0 ml-2">
                              <span className="font-medium block">{formatCents(row.costCents)}</span>
                              <span className="text-xs text-muted-foreground block">
                                in {formatTokens(row.inputTokens)} / out {formatTokens(row.outputTokens)} tok
                              </span>
                              {(row.apiRunCount > 0 || row.subscriptionRunCount > 0) && (
                                <span className="text-xs text-muted-foreground block">
                                  {row.apiRunCount > 0 ? `api runs: ${row.apiRunCount}` : null}
                                  {row.apiRunCount > 0 && row.subscriptionRunCount > 0 ? " | " : null}
                                  {row.subscriptionRunCount > 0
                                    ? `subscription runs: ${row.subscriptionRunCount} (${formatTokens(row.subscriptionInputTokens)} in / ${formatTokens(row.subscriptionOutputTokens)} out tok)`
                                    : null}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <h3 className="text-sm font-semibold mb-3">By Project</h3>
                    {spendData.byProject.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No project-attributed run costs yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {spendData.byProject.map((row) => (
                          <div
                            key={row.projectId ?? "na"}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="truncate">
                              {row.projectName ?? row.projectId ?? "Unattributed"}
                            </span>
                            <span className="font-medium">{formatCents(row.costCents)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}
        </TabsContent>

        {/* ── providers tab ─────────────────────────────────────────── */}
        <TabsContent value="providers" className="mt-4">
          {preset === "custom" && !customReady ? (
            <p className="text-sm text-muted-foreground">Select a start and end date to load data.</p>
          ) : (
            <Tabs value={activeProvider} onValueChange={setActiveProvider}>
              <PageTabBar
                items={providerTabItems}
                value={activeProvider}
                onValueChange={setActiveProvider}
              />

              <TabsContent value="all" className="mt-4">
                {providers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No cost events in this period.</p>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {providers.map((p) => (
                      <ProviderQuotaCard
                        key={p}
                        provider={p}
                        rows={byProvider.get(p)!}
                        budgetMonthlyCents={spendData?.summary.budgetCents ?? 0}
                        totalCompanySpendCents={spendData?.summary.spendCents ?? 0}
                        weekSpendCents={weekSpendByProvider.get(p) ?? 0}
                        windowRows={windowSpendByProvider.get(p) ?? []}
                        showDeficitNotch={deficitNotchByProvider.get(p) ?? false}
                        quotaWindows={quotaWindowsByProvider.get(p) ?? []}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              {providers.map((p) => (
                <TabsContent key={p} value={p} className="mt-4">
                  <ProviderQuotaCard
                    provider={p}
                    rows={byProvider.get(p)!}
                    budgetMonthlyCents={spendData?.summary.budgetCents ?? 0}
                    totalCompanySpendCents={spendData?.summary.spendCents ?? 0}
                    weekSpendCents={weekSpendByProvider.get(p) ?? 0}
                    windowRows={windowSpendByProvider.get(p) ?? []}
                    showDeficitNotch={deficitNotchByProvider.get(p) ?? false}
                    quotaWindows={quotaWindowsByProvider.get(p) ?? []}
                  />
                </TabsContent>
              ))}
            </Tabs>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
