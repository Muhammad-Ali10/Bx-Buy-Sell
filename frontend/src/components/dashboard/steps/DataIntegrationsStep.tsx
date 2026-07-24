import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface DataIntegrationsStepProps {
  formData?: any;
  onNext: (data: { integrations: string[] }) => void;
  onBack: () => void;
}

interface Integration {
  id: string;
  name: string;
  logo: string;
}

export const DataIntegrationsStep = ({ formData: parentFormData, onNext, onBack }: DataIntegrationsStepProps) => {
  const [connectedIntegrations, setConnectedIntegrations] = useState<string[]>(parentFormData?.integrations || []);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (parentFormData?.integrations) {
      setConnectedIntegrations(parentFormData.integrations);
    }
  }, [parentFormData]);

  useEffect(() => {
    // Using static data since API doesn't have integrations endpoint yet
    // TODO: Replace with API call when backend endpoint is available
    setIntegrations([
      { id: "1", name: "Google Analytics", logo: "/placeholder.svg" },
      { id: "2", name: "Stripe", logo: "/placeholder.svg" },
      { id: "3", name: "QuickBooks", logo: "/placeholder.svg" },
    ]);
    setLoading(false);
  }, []);

  const handleConnect = (integrationId: string) => {
    if (connectedIntegrations.includes(integrationId)) {
      setConnectedIntegrations(connectedIntegrations.filter(id => id !== integrationId));
    } else {
      setConnectedIntegrations([...connectedIntegrations, integrationId]);
    }
  };

  const handleSkip = () => {
    onNext({ integrations: [] });
  };

  const handleContinue = () => {
    onNext({ integrations: connectedIntegrations });
  };

  if (loading) {
    return (
      <div className="max-w-5xl">
        <h1 className="text-3xl font-bold mb-2">Data Integrations</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 rounded-2xl border-2 border-border bg-card animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <h1 className="text-3xl font-bold mb-2">Data Integrations</h1>
      <p className="text-muted-foreground mb-4">More trust. More offers. More buyers.</p>
      
      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
        <p className="text-sm text-blue-900 dark:text-blue-100 mb-2">
          <span className="font-semibold">Earn the Company Exchange Verified Badge</span>
          <span className="ml-2 px-2 py-1 bg-blue-200 dark:bg-blue-900 text-blue-900 dark:text-blue-100 rounded text-xs">
            Verified Listing 👤 🏆
          </span>
        </p>
        <p className="text-sm text-muted-foreground">
          98% of successful listings are connected to one or more data sources. When you financial and operational metrics increase your listing visibility and your chances of sale.
        </p>
      </div>

      <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2 flex items-center gap-2">
          <span className="text-xl">ℹ️</span> Data Sync
        </h3>
        <ul className="text-sm text-muted-foreground space-y-1 ml-6 list-disc">
          <li>Company Exchange will automatically update your monthly performance.</li>
          <li>Some data providers do take some time. We will sync the data in the background whilst you correlate your listing and you'd be notified when it is available.</li>
        </ul>
      </div>

      <h2 className="text-2xl font-semibold mb-6">Please connect your tools here</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {integrations.map((integration) => {
          const isConnected = connectedIntegrations.includes(integration.id);
          
          return (
            <div
              key={integration.id}
              className={`flex flex-col items-center gap-4 p-8 rounded-2xl border-2 transition-all ${
                isConnected 
                  ? "border-accent bg-accent/5" 
                  : "border-border bg-card"
              }`}
            >
              <div className="w-20 h-20 flex items-center justify-center">
                <img src={integration.logo} alt={integration.name} className="w-full h-full object-contain" />
              </div>
              <span className="text-lg font-semibold text-center">{integration.name}</span>
              <Button
                onClick={() => handleConnect(integration.id)}
                variant={isConnected ? "default" : "outline"}
                size="sm"
                className="rounded-full px-6"
              >
                {isConnected ? "Connected" : "Connect"}
              </Button>
            </div>
          );
        })}
      </div>

      <div className="flex gap-4">
        <Button onClick={onBack} variant="outline">
          Back
        </Button>
        <Button onClick={handleSkip} variant="outline" className="bg-accent text-accent-foreground hover:bg-accent/90">
          Skip Data Integration
        </Button>
        <Button onClick={handleContinue}>
          Continue
        </Button>
      </div>
    </div>
  );
};
