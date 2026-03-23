import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const directoryPath = path.join(__dirname, 'client');

const replacements = [
    // Accents
    { rx: /bg-\[hsl\(158,100%,50%\)\]\/([0-9]+)/g, repl: "bg-amber-400/$1" },
    { rx: /bg-\[hsl\(158,100%,50%\)\]/g, repl: "bg-amber-400" },
    { rx: /text-\[hsl\(158,100%,50%\)\]\/([0-9]+)/g, repl: "text-amber-400/$1" },
    { rx: /text-\[hsl\(158,100%,50%\)\]/g, repl: "text-amber-400" },
    { rx: /border-\[hsl\(158,100%,50%\)\]\/([0-9]+)/g, repl: "border-amber-400/$1" },
    { rx: /border-\[hsl\(158,100%,50%\)\]/g, repl: "border-amber-400" },
    { rx: /from-\[hsl\(158,100%,50%\)\]/g, repl: "from-amber-400" },
    { rx: /to-\[hsl\(158,100%,50%\)\]/g, repl: "to-amber-400" },
    { rx: /hsl\(158,\s*100%,\s*50%\)/g, repl: "#F59E0B" },
    { rx: /rgba\(0,\s*255,\s*136/g, repl: "rgba(245, 158, 11" },

    // Backgrounds & Surfaces
    { rx: /bg-black/g, repl: "bg-stone-950" },
    { rx: /bg-\[#0a0a0a\]/g, repl: "bg-stone-950" },
    { rx: /bg-\[#111\]/g, repl: "bg-stone-900" },
    { rx: /bg-white\/\[0\.0[23456]\]/g, repl: "bg-stone-900" },
    { rx: /bg-white\/5(?!0)/g, repl: "bg-stone-900" },
    { rx: /bg-white\/10/g, repl: "bg-stone-800" },
    { rx: /bg-white\/20/g, repl: "bg-stone-800" },

    // Borders
    { rx: /border-white\/10/g, repl: "border-stone-800" },
    { rx: /border-white\/5/g, repl: "border-stone-800" },
    { rx: /border-white\/20/g, repl: "border-stone-700" },
    { rx: /border-white\/30/g, repl: "border-stone-700" },

    // Text
    { rx: /text-white\/90/g, repl: "text-stone-50" },
    { rx: /text-white\/80/g, repl: "text-stone-200" },
    { rx: /text-white\/70/g, repl: "text-stone-300" },
    { rx: /text-white\/60/g, repl: "text-stone-400" },
    { rx: /text-white\/50/g, repl: "text-stone-400" },
    { rx: /text-white\/40/g, repl: "text-stone-500" },
    { rx: /text-white\/30/g, repl: "text-stone-500" },
    { rx: /text-white\/20/g, repl: "text-stone-600" },
    { rx: /text-white\/10/g, repl: "text-stone-700" },
    { rx: /text-white(?![\/\w\-])/g, repl: "text-stone-50" },
];

let updatedCount = 0;

function processDirectory(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDirectory(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts') || fullPath.endsWith('.css') || fullPath.endsWith('.html')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let updated = content;
            for (const r of replacements) {
                updated = updated.replace(r.rx, r.repl);
            }
            if (updated !== content) {
                fs.writeFileSync(fullPath, updated, 'utf8');
                console.log(`Updated ${fullPath}`);
                updatedCount++;
            }
        }
    }
}

processDirectory(directoryPath);
console.log(`Updated ${updatedCount} files.`);
