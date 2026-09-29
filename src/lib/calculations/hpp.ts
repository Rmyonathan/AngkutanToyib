/**
 * Financial calculation utilities — DO-centric (one trip = one Delivery Order).
 * Revenue = DO.netto × Customer.ratePerTon
 */

export type CostConfigInput = {
  globalSolarPrice: number;
  globalTirePrice: number;
  tireLifespanDays: number;
  defaultMaintenanceBudget: number;
  defaultCicilan: number;
  defaultDepreciation: number;
  defaultMovingCost: number;
  estimatedOpsDaysPerMonth: number;
};

export type UnitEconomicsInput = {
  purchasePrice?: number | null;
  estimatedSalvageValue?: number | null;
  economicLifespanDays?: number | null;
  estimatedOpsDaysPerMonth?: number | null;
  monthlyCicilan?: number | null;
  monthlyMaintenanceBudget?: number | null;
  monthlyMovingCost?: number | null;
  allocatedTonasePerPeriod?: number | null;
};

export type DriverCostInput = {
  salarySystem: "PER_TON" | "MONTHLY" | "DAILY";
  driverRatePerTon: number;
  monthlySalary?: number | null;
  dailySalary?: number | null;
};

/** One Delivery Order (weighbridge ticket) financial inputs */
export type DeliveryOrderFinancialInput = {
  /** Netto dari tiket timbangan — billing tonnage */
  netto: number;
  solarConsumedLiters: number;
  solarPricePerLiter: number;
  ratePerTon: number;
  /**
   * Share of daily fixed costs for this DO (0–1).
   * Default 1 = charge full daily allocation to this trip.
   */
  dailyCostShare?: number;
};

/** @deprecated Use DeliveryOrderFinancialInput */
export type DailyOpFinancialInput = DeliveryOrderFinancialInput & {
  totalTonase: number;
  ritaseCount?: number;
};

export type HppBreakdown = {
  solarCost: number;
  driverCost: number;
  tireCost: number;
  maintenance: number;
  cicilan: number;
  depreciation: number;
  moving: number;
  totalHpp: number;
};

export type ProfitabilityResult = {
  revenue: number;
  totalHpp: number;
  grossProfit: number;
  profitPerTon: number;
  marginPercent: number;
  hpp: HppBreakdown;
};

// ─── 1. Revenue ──────────────────────────────────────────────────────────────

/** Revenue = Netto (ton) × Rate per Ton */
export function calculateRevenue(netto: number, ratePerTon: number): number {
  return netto * ratePerTon;
}

// ─── 2. Dynamic HPP components ───────────────────────────────────────────────

export function calculateSolarCost(
  solarConsumedLiters: number,
  solarPricePerLiter: number
): number {
  return solarConsumedLiters * solarPricePerLiter;
}

export function calculateDriverCost(
  netto: number,
  driver: DriverCostInput,
  opsDaysPerMonth = 25,
  dailyCostShare = 1
): number {
  switch (driver.salarySystem) {
    case "PER_TON":
      return netto * driver.driverRatePerTon;
    case "MONTHLY":
      return ((driver.monthlySalary ?? 0) / Math.max(opsDaysPerMonth, 1)) * dailyCostShare;
    case "DAILY":
      return (driver.dailySalary ?? 0) * dailyCostShare;
    default:
      return netto * driver.driverRatePerTon;
  }
}

export function calculateTireCost(
  tirePrice: number,
  tireLifespanDays: number
): number {
  if (tireLifespanDays <= 0) return 0;
  return tirePrice / tireLifespanDays;
}

export function calculateMaintenanceCost(
  maintenanceBudget: number,
  estimatedOpsDays: number
): number {
  if (estimatedOpsDays <= 0) return 0;
  return maintenanceBudget / estimatedOpsDays;
}

export function calculateCicilanCost(
  monthlyInstallment: number,
  operationalDays: number
): number {
  if (operationalDays <= 0) return 0;
  return monthlyInstallment / operationalDays;
}

export function calculateDepreciationCost(
  unit: UnitEconomicsInput,
  defaultDepreciationPerDay: number
): number {
  const purchase = unit.purchasePrice;
  const lifespan = unit.economicLifespanDays;
  if (purchase != null && purchase > 0 && lifespan != null && lifespan > 0) {
    const salvage = unit.estimatedSalvageValue ?? 0;
    return (purchase - salvage) / lifespan;
  }
  return defaultDepreciationPerDay;
}

export function calculateMovingCost(
  movingCost: number,
  allocatedTonasePerPeriod: number | null | undefined,
  netto: number,
  opsDaysPerMonth: number,
  dailyCostShare = 1
): number {
  if (allocatedTonasePerPeriod != null && allocatedTonasePerPeriod > 0) {
    return (movingCost / allocatedTonasePerPeriod) * netto;
  }
  if (opsDaysPerMonth <= 0) return 0;
  return (movingCost / opsDaysPerMonth) * dailyCostShare;
}

function resolveOpInput(
  op: DeliveryOrderFinancialInput | DailyOpFinancialInput
): DeliveryOrderFinancialInput {
  if ("netto" in op && typeof op.netto === "number") {
    return op;
  }
  const legacy = op as DailyOpFinancialInput;
  return {
    netto: legacy.totalTonase,
    solarConsumedLiters: legacy.solarConsumedLiters,
    solarPricePerLiter: legacy.solarPricePerLiter,
    ratePerTon: legacy.ratePerTon,
    dailyCostShare: 1,
  };
}

/** Sum of HPP components for one Delivery Order */
export function calculateHpp(params: {
  op: DeliveryOrderFinancialInput | DailyOpFinancialInput;
  driver: DriverCostInput;
  costConfig: CostConfigInput;
  unit?: UnitEconomicsInput;
}): HppBreakdown {
  const op = resolveOpInput(params.op);
  const { driver, costConfig } = params;
  const unit = params.unit ?? {};
  const opsDays =
    unit.estimatedOpsDaysPerMonth && unit.estimatedOpsDaysPerMonth > 0
      ? unit.estimatedOpsDaysPerMonth
      : costConfig.estimatedOpsDaysPerMonth;
  const share = op.dailyCostShare ?? 1;

  const solarCost = calculateSolarCost(
    op.solarConsumedLiters,
    op.solarPricePerLiter || costConfig.globalSolarPrice
  );

  const driverCost = calculateDriverCost(op.netto, driver, opsDays, share);

  const tireCost =
    calculateTireCost(costConfig.globalTirePrice, costConfig.tireLifespanDays) *
    share;

  const maintenanceBudget =
    unit.monthlyMaintenanceBudget ?? costConfig.defaultMaintenanceBudget;
  const maintenance =
    calculateMaintenanceCost(maintenanceBudget, opsDays) * share;

  const cicilanMonthly = unit.monthlyCicilan ?? costConfig.defaultCicilan;
  const cicilan = calculateCicilanCost(cicilanMonthly, opsDays) * share;

  const depreciation =
    calculateDepreciationCost(unit, costConfig.defaultDepreciation) * share;

  const movingBudget = unit.monthlyMovingCost ?? costConfig.defaultMovingCost;
  const moving = calculateMovingCost(
    movingBudget,
    unit.allocatedTonasePerPeriod,
    op.netto,
    opsDays,
    share
  );

  const totalHpp =
    solarCost +
    driverCost +
    tireCost +
    maintenance +
    cicilan +
    depreciation +
    moving;

  return {
    solarCost,
    driverCost,
    tireCost,
    maintenance,
    cicilan,
    depreciation,
    moving,
    totalHpp,
  };
}

export function calculateGrossProfit(revenue: number, totalHpp: number): number {
  return revenue - totalHpp;
}

export function calculateProfitPerTon(
  grossProfit: number,
  netto: number
): number {
  if (netto <= 0) return 0;
  return grossProfit / netto;
}

export function calculateMarginPercent(
  grossProfit: number,
  revenue: number
): number {
  if (revenue <= 0) return 0;
  return (grossProfit / revenue) * 100;
}

/** Full profitability snapshot for one Delivery Order */
export function calculateProfitability(params: {
  op: DeliveryOrderFinancialInput | DailyOpFinancialInput;
  driver: DriverCostInput;
  costConfig: CostConfigInput;
  unit?: UnitEconomicsInput;
}): ProfitabilityResult {
  const op = resolveOpInput(params.op);
  const revenue = calculateRevenue(op.netto, op.ratePerTon);
  const hpp = calculateHpp({ ...params, op });
  const grossProfit = calculateGrossProfit(revenue, hpp.totalHpp);

  return {
    revenue,
    totalHpp: hpp.totalHpp,
    grossProfit,
    profitPerTon: calculateProfitPerTon(grossProfit, op.netto),
    marginPercent: calculateMarginPercent(grossProfit, revenue),
    hpp,
  };
}

export function aggregateProfitability(
  rows: ProfitabilityResult[]
): Omit<ProfitabilityResult, "hpp"> & { cashOut: number } {
  const revenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalHpp = rows.reduce((s, r) => s + r.totalHpp, 0);
  const grossProfit = revenue - totalHpp;

  return {
    revenue,
    totalHpp,
    grossProfit,
    profitPerTon: 0,
    marginPercent: calculateMarginPercent(grossProfit, revenue),
    cashOut: totalHpp,
  };
}
