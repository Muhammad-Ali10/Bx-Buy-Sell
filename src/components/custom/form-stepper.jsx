"use client";

import { Button } from "@/components/ui/button";
import {
  Stepper,
  StepperIndicator,
  StepperItem,
  StepperTrigger,
} from "@/components/ui/stepper";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import clsx from "clsx";
const steps = [1, 2, 3];

function FormStepper({currentStep, setCurrentStep}) {
 

  return (
    <div className="mx-auto max-w-xl space-y-8 text-center min-w-[300px]">
      <div className="flex items-center gap-2">
        <Button
          className="shrink-0"
          variant="ghost"
          size="icon"
          onClick={() => setCurrentStep((prev) => prev - 1)}
          disabled={currentStep === 1}
          aria-label="Prev step"
        >
          <ChevronLeftIcon size={16} strokeWidth={2} aria-hidden="true" />
        </Button>
        <Stepper value={currentStep} onValueChange={setCurrentStep} className="gap-1 ">
          {steps.map((step) => (
            <StepperItem key={step} step={step} className="flex-1 ">
              <StepperTrigger className="w-full flex-col  items-start gap-2" asChild>
                <StepperIndicator asChild className={ clsx(currentStep === step && "bg-[#0067FF]", "h-2 w-full ")}>
                  <span className="sr-only ">{step}</span>
                </StepperIndicator>
              </StepperTrigger>
            </StepperItem>
          ))}
        </Stepper>
        <Button
          className="shrink-0"
          variant="ghost"
          size="icon"
          onClick={() => setCurrentStep((prev) => prev + 1)}
          disabled={currentStep === steps.length}
          aria-label="Next step"
        >
          <ChevronRightIcon size={16} strokeWidth={2} aria-hidden="true" />
        </Button>
      </div>
      
    </div>
  );
}

export { FormStepper };
