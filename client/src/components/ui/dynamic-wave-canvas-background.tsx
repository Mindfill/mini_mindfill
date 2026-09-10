import React, { useEffect, useRef } from 'react';

const HeroWave = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let width: number, height: number;
        let imageData: ImageData, data: Uint8ClampedArray;
        const SCALE = 2;

        const resizeCanvas = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            width = Math.floor(canvas.width / SCALE);
            height = Math.floor(canvas.height / SCALE);
            imageData = ctx.createImageData(width, height);
            data = imageData.data;
        };

        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        const startTime = Date.now();

        const SIN_TABLE = new Float32Array(1024);
        const COS_TABLE = new Float32Array(1024);
        for (let i = 0; i < 1024; i++) {
            const angle = (i / 1024) * Math.PI * 2;
            SIN_TABLE[i] = Math.sin(angle);
            COS_TABLE[i] = Math.cos(angle);
        }

        const fastSin = (x: number) => {
            const index = Math.floor(((x % (Math.PI * 2)) / (Math.PI * 2)) * 1024) & 1023;
            return SIN_TABLE[index];
        };

        const fastCos = (x: number) => {
            const index = Math.floor(((x % (Math.PI * 2)) / (Math.PI * 2)) * 1024) & 1023;
            return COS_TABLE[index];
        };

        let rafId: number;

        const render = () => {
            const time = (Date.now() - startTime) * 0.001;

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const u_x = (2 * x - width) / height;
                    const u_y = (2 * y - height) / height;

                    let a = 0;
                    let d = 0;

                    for (let i = 0; i < 4; i++) {
                        a += fastCos(i - d + time * 0.5 - a * u_x);
                        d += fastSin(i * u_y + a);
                    }

                    const wave = (fastSin(a) + fastCos(d)) * 0.5;
                    const intensity = 0.35 + 0.45 * wave;

                    // Neon-blue palette derived from the site theme (~hsl(212 90% 55%)).
                    // glowT/shimmer are both normalized to 0..1 (not signed) so the
                    // hue never flips warm — only brightness/glow varies, always
                    // staying deep-navy-to-vivid-blue/cyan.
                    const glowT = 0.5 + 0.5 * fastSin(a * 1.2 + time * 0.15);
                    const shimmer = 0.5 + 0.5 * fastCos(d * 1.7 + time * 0.1);

                    const r = Math.max(0, Math.min(1, 0.02 + glowT * 0.10 + shimmer * 0.04)) * intensity;
                    const g = Math.max(0, Math.min(1, 0.05 + glowT * 0.30 + shimmer * 0.12)) * intensity;
                    const b = Math.max(0, Math.min(1, 0.18 + glowT * 0.65 + shimmer * 0.25)) * intensity;

                    const idx = (y * width + x) * 4;
                    data[idx] = r * 255;
                    data[idx + 1] = g * 255;
                    data[idx + 2] = b * 255;
                    data[idx + 3] = 255;
                }
            }

            ctx.putImageData(imageData, 0, 0);
            if (SCALE > 1) {
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(canvas, 0, 0, width, height, 0, 0, canvas.width, canvas.height);
            }

            rafId = requestAnimationFrame(render);
        };

        render();

        return () => {
            cancelAnimationFrame(rafId);
            window.removeEventListener('resize', resizeCanvas);
        };
    }, []);

    return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
};

export default HeroWave;
