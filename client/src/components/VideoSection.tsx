import { useState } from "react";
import { Play } from "lucide-react";
import AnimatedGradientBg from "@/components/ui/animated-gradient-bg";

export default function VideoSection() {
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlay = () => {
    setIsPlaying(true);
    console.log("Video play triggered");
  };

  return (
    <section id="how-it-works" className="py-20 md:py-32 px-6 lg:px-8 relative overflow-hidden bg-black">
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="flex flex-col items-center text-center mb-16 md:mb-20">
          <p className="text-primary text-xs font-bold tracking-[0.3em] uppercase mb-4">The Experience</p>
          <h2 className="text-3xl md:text-6xl font-bold text-white tracking-tight leading-tight" data-testid="text-video-headline">
            Experience the <br className="hidden md:block" />
            <span className="text-white/40">TECHCESS Interface.</span>
          </h2>
        </div>

        <div className="max-w-5xl mx-auto">
          <div
            className="relative rounded-2xl overflow-hidden border border-white/5 group cursor-pointer transition-all duration-500 bg-white/5 backdrop-blur-sm shadow-2xl"
            style={{
              aspectRatio: "16 / 9",
            }}
            onClick={handlePlay}
            data-testid="container-video"
          >
            {!isPlaying ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
                
                <div className="text-center relative z-10 p-6">
                  <div
                    className="w-16 h-16 md:w-20 md:h-20 mx-auto mb-4 md:mb-6 rounded-full bg-white text-black flex items-center justify-center transition-all duration-500 group-hover:scale-110 shadow-2xl"
                    data-testid="button-play-video"
                  >
                    <Play className="w-6 h-6 md:w-8 md:h-8 ml-1" fill="currentColor" />
                  </div>
                  <p className="text-xs md:text-sm font-medium tracking-wide text-white/60">
                    See TECHCESS in action
                  </p>
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 bg-black flex items-center justify-center">
                <video
                  className="w-full h-full object-contain"
                  controls
                  autoPlay
                  data-testid="video-player"
                >
                  <source src="/video/MindfillFirst_web.mp4" type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              </div>
            )}
          </div>

          <div className="mt-10 md:mt-12 flex flex-wrap justify-center gap-6 md:gap-8">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span className="text-[10px] md:text-xs font-bold tracking-widest uppercase text-white/30">Adaptive AI</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span className="text-[10px] md:text-xs font-bold tracking-widest uppercase text-white/30">Dynamic Visuals</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span className="text-[10px] md:text-xs font-bold tracking-widest uppercase text-white/30">Deep Reasoning</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
