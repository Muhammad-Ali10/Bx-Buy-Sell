import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Search, User, CheckCircle2 } from "lucide-react";

interface WelcomeDialogProps {
  isNewUser: boolean;
  userType?: string;
}

export const WelcomeDialog = ({ isNewUser, userType }: WelcomeDialogProps) => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const navigate = useNavigate();

  useEffect(() => {
    // Show welcome dialog for new users
    const hasSeenWelcome = localStorage.getItem("hasSeenWelcome");
    if (isNewUser && !hasSeenWelcome) {
      setOpen(true);
    }
  }, [isNewUser]);

  const handleClose = () => {
    localStorage.setItem("hasSeenWelcome", "true");
    setOpen(false);
  };

  const handleGetStarted = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      handleClose();
      if (userType === "seller") {
        navigate("/dashboard");
      } else {
        navigate("/");
      }
    }
  };

  const steps = [
    {
      title: "Welcome to EX! 🎉",
      description: "The most trusted marketplace for business acquisitions",
      icon: <CheckCircle2 className="w-16 h-16 text-accent mx-auto mb-4" />,
      content: (
        <div className="space-y-4">
          <p className="text-center text-muted-foreground">
            You're now part of a community connecting buyers and sellers worldwide.
          </p>
          <div className="grid gap-3">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm">Verified Listings</h4>
                  <p className="text-xs text-muted-foreground">All companies are verified</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm">Secure Transactions</h4>
                  <p className="text-xs text-muted-foreground">Escrow services available</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      ),
    },
    {
      title: userType === "seller" ? "Create Your First Listing" : "Discover Companies",
      description: userType === "seller" 
        ? "List your company and reach thousands of potential buyers"
        : "Browse verified listings and find your perfect acquisition",
      icon: userType === "seller" 
        ? <Plus className="w-16 h-16 text-accent mx-auto mb-4" />
        : <Search className="w-16 h-16 text-accent mx-auto mb-4" />,
      content: (
        <div className="space-y-4">
          {userType === "seller" ? (
            <>
              <p className="text-center text-muted-foreground">
                Our simple 9-step process makes listing your company easy and secure.
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-accent" />
                  <span>Select your business category</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-accent" />
                  <span>Add financial details</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-accent" />
                  <span>Upload business photos</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-accent" />
                  <span>Choose your pricing package</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="text-center text-muted-foreground">
                Search by category, location, or price range to find companies that match your criteria.
              </p>
              <Card className="p-4 bg-muted">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-accent" />
                    <span>Filter by industry and revenue</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-accent" />
                    <span>View detailed financials</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-accent" />
                    <span>Connect directly with sellers</span>
                  </div>
                </div>
              </Card>
            </>
          )}
        </div>
      ),
    },
    {
      title: "Complete Your Profile",
      description: "Add your details to build trust with the community",
      icon: <User className="w-16 h-16 text-accent mx-auto mb-4" />,
      content: (
        <div className="space-y-4">
          <p className="text-center text-muted-foreground">
            A complete profile helps build credibility and trust in our marketplace.
          </p>
          <Card className="p-4">
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-accent" />
                <span>Add your professional photo</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-accent" />
                <span>Include contact information</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-accent" />
                <span>Write a brief bio</span>
              </div>
              {userType === "seller" && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-accent" />
                  <span>Add company details</span>
                </div>
              )}
            </div>
          </Card>
        </div>
      ),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl">{steps[step - 1].title}</DialogTitle>
          <DialogDescription>{steps[step - 1].description}</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {steps[step - 1].icon}
          {steps[step - 1].content}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-2 w-8 rounded-full transition-colors ${
                  i + 1 === step ? "bg-accent" : "bg-muted"
                }`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={handleClose}>
              Skip
            </Button>
            <Button variant="accent" onClick={handleGetStarted}>
              {step < 3 ? "Next" : "Get Started"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
