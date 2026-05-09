import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import VideoSection from "@/components/VideoSection";
import MindfillMethodSection from "@/components/MindfillMethodSection";
import WhyMindfillSection from "@/components/WhyMindfillSection";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";
import { useEffect } from "react";

export default function Home() {
  useEffect(() => {
    document.title = "TECHCESS - Mastery through Deep Reasoning";
  }, []);

  return (
    <div className="min-h-screen text-white flex flex-col bg-black">
      <Navbar />
      <HeroSection />
      <VideoSection />
      <MindfillMethodSection />
      <WhyMindfillSection />
      <CTASection />
      <Footer />
    </div>
  );
}
