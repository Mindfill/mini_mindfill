import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import VideoSection from "@/components/VideoSection";
import MindfillMethodSection from "@/components/MindfillMethodSection";
import WhyMindfillSection from "@/components/WhyMindfillSection";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="min-h-screen text-stone-900 flex flex-col" style={{ backgroundColor: "#C9C9C5" }}>
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
