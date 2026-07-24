import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { CheckCircle, Search, MessageSquare, Handshake, Shield, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";

const HowToBuy = () => {
  const steps = [
    {
      icon: Search,
      title: "Browse Listings",
      description: "Explore our extensive marketplace of verified business listings. Use filters to find businesses that match your criteria.",
      color: "text-blue-600",
      bgColor: "bg-blue-50"
    },
    {
      icon: MessageSquare,
      title: "Contact Seller",
      description: "Reach out directly to sellers through our secure messaging system. Ask questions and negotiate terms.",
      color: "text-green-600",
      bgColor: "bg-green-50"
    },
    {
      icon: Handshake,
      title: "Negotiate & Verify",
      description: "Review business details, financials, and documentation. Negotiate terms that work for both parties.",
      color: "text-purple-600",
      bgColor: "bg-purple-50"
    },
    {
      icon: Shield,
      title: "Secure Transaction",
      description: "Use EX Pay for secure, escrow-protected transactions. Your funds are safe until the deal is complete.",
      color: "text-orange-600",
      bgColor: "bg-orange-50"
    },
    {
      icon: TrendingUp,
      title: "Take Ownership",
      description: "Complete the handover process and start running your new business. We provide support throughout the transition.",
      color: "text-indigo-600",
      bgColor: "bg-indigo-50"
    }
  ];

  const benefits = [
    "Verified business listings with complete financial data",
    "Direct communication with sellers",
    "Secure payment processing through EX Pay",
    "Comprehensive business documentation",
    "Support throughout the buying process",
    "Access to business analytics and insights"
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <main className="flex-1 pt-24 pb-16">
        {/* Hero Section */}
        <section className="bg-gradient-to-br from-primary/10 via-primary/5 to-background py-20">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                How To Buy a Business
              </h1>
              <p className="text-xl text-muted-foreground mb-8">
                Your complete guide to finding and acquiring the perfect business opportunity
              </p>
              <div className="flex gap-4 justify-center">
                <Button size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground rounded-full px-8" asChild>
                  <Link to="/all-listings">Browse Listings</Link>
                </Button>
                <Button size="lg" variant="outline" className="rounded-full px-8" asChild>
                  <Link to="/register">Create Account</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Steps Section */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-4xl font-bold text-center mb-4">The Buying Process</h2>
              <p className="text-center text-muted-foreground text-lg mb-12">
                Follow these simple steps to acquire your dream business
              </p>
              
              <div className="space-y-8">
                {steps.map((step, index) => {
                  const Icon = step.icon;
                  return (
                    <div key={index} className="flex gap-6 items-start">
                      <div className={`flex-shrink-0 w-16 h-16 ${step.bgColor} rounded-full flex items-center justify-center`}>
                        <Icon className={`w-8 h-8 ${step.color}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-2xl font-bold text-muted-foreground">0{index + 1}</span>
                          <h3 className="text-2xl font-bold">{step.title}</h3>
                        </div>
                        <p className="text-muted-foreground text-lg">{step.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-4xl font-bold text-center mb-4">Why Buy Through EX?</h2>
              <p className="text-center text-muted-foreground text-lg mb-12">
                We make business acquisition simple, secure, and successful
              </p>
              
              <div className="grid md:grid-cols-2 gap-6">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-start gap-3 p-4 bg-card rounded-xl border border-border">
                    <CheckCircle className="w-6 h-6 text-accent flex-shrink-0 mt-0.5" />
                    <p className="text-foreground font-medium">{benefit}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center bg-gradient-to-r from-primary/10 to-accent/10 rounded-2xl p-12 border border-border">
              <h2 className="text-4xl font-bold mb-4">Ready to Find Your Business?</h2>
              <p className="text-xl text-muted-foreground mb-8">
                Start browsing verified listings today and take the first step towards business ownership
              </p>
              <div className="flex gap-4 justify-center">
                <Button size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground rounded-full px-8" asChild>
                  <Link to="/all-listings">Explore Listings</Link>
                </Button>
                <Button size="lg" variant="outline" className="rounded-full px-8" asChild>
                  <Link to="/register">Get Started</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default HowToBuy;























