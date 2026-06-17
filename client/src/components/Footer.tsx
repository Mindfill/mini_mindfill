import { SiX, SiInstagram } from "react-icons/si";
import mindfillLogo from "/images/mindfill.png";

export default function Footer() {
  return (
    <footer className="bg-black border-t border-white/5 py-16 md:py-24 px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-12">
          <div className="col-span-1 sm:col-span-2 flex flex-col items-start gap-6">
            <div className="flex items-center gap-3">
              <img 
                src={mindfillLogo} 
                alt="TECHCESS Logo" 
                className="w-8 h-8 object-contain"
              />
              <h3 className="text-lg font-bold text-white tracking-tight">
                TECHCESS
              </h3>
            </div>
            <p className="text-sm text-white/30 max-w-xs leading-relaxed">
              Bridging the gap between intuition and formal mastery through AI-powered understanding.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <h4 className="text-[10px] md:text-xs font-bold tracking-widest uppercase text-white/20">Platform</h4>
            <nav className="flex flex-col gap-2">
              <a href="#method" className="text-sm text-white/50 hover:text-white transition-colors">Methodology</a>
              <a href="#how-it-works" className="text-sm text-white/50 hover:text-white transition-colors">Walkthrough</a>
              <a href="#why-mindfill" className="text-sm text-white/50 hover:text-white transition-colors">Benefits</a>
            </nav>
          </div>

          <div className="flex flex-col gap-4">
            <h4 className="text-[10px] md:text-xs font-bold tracking-widest uppercase text-white/20">Social</h4>
            <div className="flex items-center gap-4">
              <a
                href="https://www.instagram.com/mindfill_official?igsh=YmZiaThlNTl4azZp"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-lg border border-white/10 flex items-center justify-center text-white/30 hover:text-white hover:border-white transition-all duration-300"
              >
                <SiInstagram className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
        
        <div className="mt-16 md:mt-24 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-[10px] md:text-xs text-white/20 text-center md:text-left">
            © 2026 TECHCESS. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-[10px] font-bold tracking-widest uppercase text-white/20 hover:text-white transition-colors">Privacy</a>
            <a href="#" className="text-[10px] font-bold tracking-widest uppercase text-white/20 hover:text-white transition-colors">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
