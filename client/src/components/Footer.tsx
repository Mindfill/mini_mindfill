import { SiX, SiInstagram } from "react-icons/si";

export default function Footer() {
  return (
    <footer className="bg-black border-t border-white/10 py-12 px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex flex-col items-center md:items-start gap-4">
            <h3 
              className="text-xl font-bold"
              style={{
                color: "hsl(158, 100%, 50%)",
                textShadow: "0 0 15px rgba(0, 255, 136, 0.5)"
              }}
              data-testid="text-footer-logo"
            >
              Mindfill
            </h3>
            <p className="text-sm text-white/50" data-testid="text-footer-copyright">
              © 2025 Mindfill. All rights reserved.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="https://www.instagram.com/mindfill_official?igsh=YmZiaThlNTl4azZp"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-white/20 text-white/70 hover:text-[hsl(158,100%,50%)] hover:border-[hsl(158,100%,50%)] transition-all duration-200"
              data-testid="link-footer-instagram"
            >
              <SiInstagram className="w-5 h-5" />
            </a>
            
          </div>
        </div>
      </div>
    </footer>
  );
}
