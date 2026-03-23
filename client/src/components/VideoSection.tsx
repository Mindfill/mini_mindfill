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
    <section id="how-it-works" className="py-24 px-6 lg:px-8 relative overflow-hidden bg-white" style={{ backgroundColor: "#C9C9C5" }}>
      <AnimatedGradientBg />
      <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 text-stone-900" data-testid="text-video-headline">
          How It Works
        </h2>

        <div className="max-w-4xl mx-auto">
          <div
            className="relative rounded-xl overflow-hidden border-2 group cursor-pointer"
            style={{
              borderColor: "rgba(245, 158, 11, 0.3)",
              boxShadow: "0 0 40px rgba(245, 158, 11, 0.2)",
              aspectRatio: "21 / 9",
            }}
            onClick={handlePlay}
            data-testid="container-video"
          >
            {!isPlaying ? (
              <div className="absolute inset-0 bg-gradient-to-br from-stone-100 via-stone-50 to-amber-50 flex items-center justify-center">
                <div className="text-center">
                  <div
                    className="w-24 h-24 mx-auto mb-6 rounded-full bg-primary flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                    style={{
                      boxShadow: "0 0 50px rgba(245, 158, 11, 0.6)",
                    }}
                    data-testid="button-play-video"
                  >
                    <Play className="w-12 h-12 text-black ml-1" fill="currentColor" />
                  </div>
                  <p className="text-sm sm:text-base md:text-lg lg:text-xl text-stone-700">
                    Watch how Mindfill transforms learning
                  </p>
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 bg-background flex items-center justify-center">
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

            <div className="absolute inset-0 pointer-events-none">
              <div
                className="absolute top-0 left-0 w-32 h-32 opacity-20"
                style={{
                  background: "radial-gradient(circle, rgba(245, 158, 11, 0.3) 0%, transparent 70%)",
                }}
              />
              <div
                className="absolute bottom-0 right-0 w-32 h-32 opacity-20"
                style={{
                  background: "radial-gradient(circle, rgba(245, 158, 11, 0.3) 0%, transparent 70%)",
                }}
              />
            </div>
          </div>

          <p className="text-center text-muted-foreground mt-6 text-sm" data-testid="text-video-note">
            Click to see Mindfill's adaptive learning system in action
          </p>
        </div>
      </div>
    </section>
  );
}
