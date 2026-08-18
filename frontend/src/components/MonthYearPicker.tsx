import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MONTHS = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

// Years from the current year back to 1970 (most recent first).
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1970 + 1 }, (_, i) =>
  String(CURRENT_YEAR - i),
);

const parseValue = (value?: string): { year: string; month: string } => {
  const match = (value ?? "").match(/^(\d{4})-(\d{2})/);
  return match ? { year: match[1], month: match[2] } : { year: "", month: "" };
};

interface MonthYearPickerProps {
  /** Stored value as `YYYY-MM` (also reads legacy `YYYY-MM-DD`). */
  value?: string;
  /** Emits `YYYY-MM` once both month and year are chosen. */
  onChange: (value: string) => void;
}

export const MonthYearPicker = ({ value, onChange }: MonthYearPickerProps) => {
  const parsed = parseValue(value);
  const [month, setMonth] = useState(parsed.month);
  const [year, setYear] = useState(parsed.year);

  // Keep local state in sync if the parent value changes externally.
  useEffect(() => {
    const next = parseValue(value);
    setMonth(next.month);
    setYear(next.year);
  }, [value]);

  const handleMonth = (m: string) => {
    setMonth(m);
    if (year) onChange(`${year}-${m}`);
  };

  const handleYear = (y: string) => {
    setYear(y);
    if (month) onChange(`${y}-${month}`);
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      <Select value={month} onValueChange={handleMonth}>
        <SelectTrigger className="bg-muted/50">
          <SelectValue placeholder="Month" />
        </SelectTrigger>
        <SelectContent>
          {MONTHS.map((m) => (
            <SelectItem key={m.value} value={m.value}>
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={year} onValueChange={handleYear}>
        <SelectTrigger className="bg-muted/50">
          <SelectValue placeholder="Year" />
        </SelectTrigger>
        <SelectContent className="max-h-[300px]">
          {YEARS.map((y) => (
            <SelectItem key={y} value={y}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default MonthYearPicker;
