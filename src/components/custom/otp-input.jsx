"use client";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { OTPInput, SlotProps } from "input-otp";
import { useId, useState } from "react";

function OTPInputComponent() {
  const id = useId();
  const [value, setValue] = useState("");
  return (
    <div className="space-y-2 min-w-[300px]">
      <OTPInput
        inputMode="numeric"
        id={id}
        value={value}
        onChange={(value) => {
          const num = Number(value);
          if (isNaN(num)) return;
          setValue(value);
        }}
        containerClassName="flex items-center gap-3 has-[:disabled]:opacity-50"
        maxLength={4}
        render={({ slots }) => (
          <div className="flex gap-2">
            {slots.map((slot, idx) => (
              <Slot key={idx}  {...slot}/>
            ))}
          </div>
        )}
      />
    </div>
  );
}

function Slot(props) {
    
  return (
    <div
      className={cn(
        "flex size-[72px] items-center  justify-center rounded-lg border border-input bg-background font-[700] text-[32px] !font-helvetica-now text-foreground shadow-sm shadow-black/5 transition-shadow",
        { "z-10 border border-ring ring-[3px] ring-ring/20": props.isActive },
      )}
    >
      {props.char !== null && <div>{props.char}</div>}
    </div>
  );
}

export { OTPInputComponent };
