import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import HowItWorksSection from "@/components/HowItWorksSection";
import MindfillMethodSection from "@/components/MindfillMethodSection";
import WhyMindfillSection from "@/components/WhyMindfillSection";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      <HeroSection />
      <HowItWorksSection />
      <MindfillMethodSection />
      <WhyMindfillSection />
      <CTASection />
      <Footer />
    </div>
  );
}
