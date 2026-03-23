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

                    // Amber/stone palette derived from the site theme
                    // Base is warm stone grey (#C9C9C5), accent is amber (#F59E0B)
                    const base = 0.78 + 0.05 * fastCos(u_x + u_y + time * 0.3);
                    const amberAccent = 0.18 * fastSin(a * 1.5 + time * 0.2);
                    const warmAccent = 0.12 * fastCos(d * 2 + time * 0.1);

                    const r = Math.max(0, Math.min(1, base + amberAccent * 1.2 + warmAccent * 0.3)) * intensity;
                    const g = Math.max(0, Math.min(1, base + amberAccent * 0.55 + warmAccent * 0.2)) * intensity;
                    const b = Math.max(0, Math.min(1, base - amberAccent * 0.4 + warmAccent * 0.1)) * intensity;

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
