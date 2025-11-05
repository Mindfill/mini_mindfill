import { useState } from "react";
import { Play } from "lucide-react";

export default function VideoSection() {
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlay = () => {
    setIsPlaying(true);
    console.log("Video play triggered");
  };

  return (
    <section id="how-it-works" className="py-24 px-6 lg:px-8 bg-black">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-16" data-testid="text-video-headline">
          How It Works
        </h2>
        
        <div className="max-w-4xl mx-auto">
          <div 
            className="relative rounded-xl overflow-hidden border-2 group cursor-pointer"
            style={{
              borderColor: "rgba(0, 255, 136, 0.3)",
              boxShadow: "0 0 40px rgba(0, 255, 136, 0.2)",
              aspectRatio: "21 / 9",
            }}
            onClick={handlePlay}
            data-testid="container-video"
          >
            {!isPlaying ? (
              <div className="absolute inset-0 bg-gradient-to-br from-black via-black/95 to-[hsl(158,100%,10%)] flex items-center justify-center">
                <div className="text-center">
                  <div 
                    className="w-24 h-24 mx-auto mb-6 rounded-full bg-[hsl(158,100%,50%)] flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                    style={{
                      boxShadow: "0 0 50px rgba(0, 255, 136, 0.6)",
                    }}
                    data-testid="button-play-video"
                  >
                    <Play className="w-12 h-12 text-black ml-1" fill="currentColor" />
                  </div>
                  <p className="text-sm sm:text-base md:text-lg lg:text-xl text-white/80">
                    Watch how Mindfill transforms learning
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
                  <source src="/video/MindfillFirst.mp4" type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              </div>
            )}
            
            <div className="absolute inset-0 pointer-events-none">
              <div 
                className="absolute top-0 left-0 w-32 h-32 opacity-20"
                style={{
                  background: "radial-gradient(circle, rgba(0, 255, 136, 0.3) 0%, transparent 70%)",
                }}
              />
              <div 
                className="absolute bottom-0 right-0 w-32 h-32 opacity-20"
                style={{
                  background: "radial-gradient(circle, rgba(0, 255, 136, 0.3) 0%, transparent 70%)",
                }}
              />
            </div>
          </div>

          <p className="text-center text-white/50 mt-6 text-sm" data-testid="text-video-note">
            Click to see Mindfill's adaptive learning system in action
          </p>
        </div>
      </div>
    </section>
  );
}
