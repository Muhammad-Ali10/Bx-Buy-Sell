import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { CheckCircle, FileText, DollarSign, Users, TrendingUp, Shield, Zap, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";

const HowToSell = () => {
  const steps = [
    {
      icon: FileText,
      title: "Create Your Listing",
      description: "Fill out our comprehensive listing form with business details, financials, and key information. Our step-by-step process makes it easy.",
      color: "text-blue-600",
      bgColor: "bg-blue-50"
    },
    {
      icon: Users,
      title: "Reach Qualified Buyers",
      description: "Your listing will be visible to thousands of verified buyers actively looking for businesses like yours.",
      color: "text-green-600",
      bgColor: "bg-green-50"
    },
    {
      icon: MessageSquare,
      title: "Communicate with Buyers",
      description: "Respond to inquiries, answer questions, and negotiate terms directly through our secure messaging platform.",
      color: "text-purple-600",
      bgColor: "bg-purple-50"
    },
    {
      icon: Shield,
      title: "Secure Payment",
      description: "Receive payments securely through EX Pay. Funds are held in escrow until the transaction is complete.",
      color: "text-orange-600",
      bgColor: "bg-orange-50"
    },
    {
      icon: TrendingUp,
      title: "Complete the Sale",
      description: "Finalize the deal, transfer ownership, and get paid. We handle the paperwork and ensure a smooth transition.",
      color: "text-indigo-600",
      bgColor: "bg-indigo-50"
    }
  ];

  const benefits = [
    "List your business for free",
    "Reach thousands of verified buyers",
    "Secure payment processing",
    "Professional listing presentation",
    "Direct buyer communication",
    "Support throughout the selling process"
  ];

  const features = [
    {
      icon: Zap,
      title: "Quick Setup",
      description: "Create your listing in minutes with our intuitive form"
    },
    {
      icon: DollarSign,
      title: "Free Listing",
      description: "List your business at no cost - we only charge on successful sale"
    },
    {
      icon: Users,
      title: "Wide Reach",
      description: "Access to a large network of serious buyers"
    },
    {
      icon: Shield,
      title: "Secure Process",
      description: "Protected transactions with escrow services"
    }
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <main className="flex-1 pt-24 pb-16">
        {/* Hero Section */}
        <section className="bg-gradient-to-br from-accent/10 via-accent/5 to-background py-20">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
                How To Sell Your Business
              </h1>
              <p className="text-xl text-muted-foreground mb-8">
                List your business for free and connect with serious buyers. Sell faster with EX.
              </p>
              <div className="flex gap-4 justify-center">
                <Button size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground rounded-full px-8" asChild>
                  <Link to="/dashboard">List Your Business</Link>
                </Button>
                <Button size="lg" variant="outline" className="rounded-full px-8" asChild>
                  <Link to="/register">Create Account</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-4xl font-bold text-center mb-4">Why Sell on EX?</h2>
              <p className="text-center text-muted-foreground text-lg mb-12">
                Everything you need to sell your business successfully
              </p>
              
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                {features.map((feature, index) => {
                  const Icon = feature.icon;
                  return (
                    <div key={index} className="bg-card rounded-xl p-6 border border-border hover:shadow-lg transition-shadow">
                      <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center mb-4">
                        <Icon className="w-6 h-6 text-accent" />
                      </div>
                      <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                      <p className="text-muted-foreground">{feature.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Steps Section */}
        <section className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-4xl font-bold text-center mb-4">The Selling Process</h2>
              <p className="text-center text-muted-foreground text-lg mb-12">
                From listing to sale - we guide you through every step
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
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-4xl font-bold text-center mb-4">Benefits of Selling on EX</h2>
              <p className="text-center text-muted-foreground text-lg mb-12">
                Everything you need for a successful sale
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
        <section className="py-20 bg-gradient-to-r from-primary/10 to-accent/10">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center bg-card rounded-2xl p-12 border border-border shadow-lg">
              <h2 className="text-4xl font-bold mb-4">Ready to Sell Your Business?</h2>
              <p className="text-xl text-muted-foreground mb-8">
                List your business for free today and start connecting with serious buyers
              </p>
              <div className="flex gap-4 justify-center">
                <Button size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground rounded-full px-8" asChild>
                  <Link to="/dashboard">Create Listing</Link>
                </Button>
                <Button size="lg" variant="outline" className="rounded-full px-8" asChild>
                  <Link to="/register">Sign Up Free</Link>
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

export default HowToSell;

