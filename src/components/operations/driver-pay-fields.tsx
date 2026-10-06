"use client";

import { Label, Select } from "@/components/ui/input";
import { MoneyField } from "@/components/ui/number-input";
import {
  DO_DRIVER_PAY_MODE,
  DRIVER_PAY_MODE_LABEL,
  type DoDriverPayMode,
} from "@/lib/operations/driver-pay-mode";
import {
  masterDriverPayDefaults,
  type MasterDriverPayProfile,
} from "@/lib/operations/driver-pay";

type Props = {
  master: MasterDriverPayProfile;
  driverName?: string;
  mode: DoDriverPayMode;
  amount: string;
  useMaster: boolean;
  onModeChange: (mode: DoDriverPayMode) => void;
  onAmountChange: (amount: string) => void;
  onUseMasterChange: (use: boolean) => void;
};

export function DriverPayFields({
  master,
  driverName,
  mode,
  amount,
  useMaster,
  onModeChange,
  onAmountChange,
  onUseMasterChange,
}: Props) {
  const defaults = masterDriverPayDefaults(master);

  function applyMaster() {
    onModeChange(defaults.mode);
    onAmountChange(defaults.amount > 0 ? String(defaults.amount) : "");
  }

  return (
    <fieldset className="space-y-2 rounded-lg border border-neutral-200 p-3">
      <legend className="px-1 text-xs font-semibold text-neutral-700">
        Gaji supir{driverName ? ` · ${driverName}` : ""}
      </legend>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={useMaster}
          onChange={(e) => {
            const on = e.target.checked;
            onUseMasterChange(on);
            if (on) applyMaster();
          }}
          className="rounded border-neutral-300"
        />
        <span>Pakai default Master Driver</span>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Jenis gaji</Label>
          <Select
            disabled={useMaster}
            value={mode}
            onChange={(e) => onModeChange(e.target.value as DoDriverPayMode)}
          >
            {Object.entries(DRIVER_PAY_MODE_LABEL).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Nominal (Rp)</Label>
          <MoneyField
            allowZero
            disabled={useMaster}
            placeholder={defaults.hint}
            value={amount}
            onChange={onAmountChange}
          />
        </div>
      </div>
      <p className="text-[11px] text-neutral-500">
        Default master: {defaults.hint}
        {mode === DO_DRIVER_PAY_MODE.PER_TON && amount
          ? " · Total = tonase × nominal"
          : mode === DO_DRIVER_PAY_MODE.PER_TRIP && amount
            ? " · Flat per trip DO ini"
            : null}
      </p>
    </fieldset>
  );
}

export function driverPayFormFromMaster(master: MasterDriverPayProfile) {
  const d = masterDriverPayDefaults(master);
  return {
    driverPayMode: d.mode,
    driverPayAmount: d.amount > 0 ? String(d.amount) : "",
    useMasterDriverPay: true,
  };
}
