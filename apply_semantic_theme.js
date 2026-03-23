import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const directoryPath = path.join(__dirname, 'client');

const replacements = [
    // Backgrounds
    { rx: /bg-stone-950/g, repl: "bg-background" },
    { rx: /bg-stone-900/g, repl: "bg-card" },
    { rx: /bg-stone-800/g, repl: "bg-muted" },

    // Accents
    { rx: /bg-amber-400(?!\/)/g, repl: "bg-primary" },
    { rx: /bg-amber-400\/([0-9]+)/g, repl: "bg-primary/$1" },
    { rx: /text-amber-400(?!\/)/g, repl: "text-primary" },
    { rx: /text-amber-400\/([0-9]+)/g, repl: "text-primary/$1" },
    { rx: /border-amber-400(?!\/)/g, repl: "border-primary" },
    { rx: /border-amber-400\/([0-9]+)/g, repl: "border-primary/$1" },
    { rx: /from-amber-400/g, repl: "from-primary" },
    { rx: /to-amber-400/g, repl: "to-primary" },

    // Borders
    { rx: /border-stone-800/g, repl: "border-border" },
    { rx: /border-stone-700/g, repl: "border-muted-foreground/30" },

    // Text
    { rx: /text-stone-50(?!\/)/g, repl: "text-foreground" },
    { rx: /text-stone-200/g, repl: "text-foreground/90" },
    { rx: /text-stone-300/g, repl: "text-muted-foreground" },
    { rx: /text-stone-400/g, repl: "text-muted-foreground" },
    { rx: /text-stone-500/g, repl: "text-muted-foreground/80" },
    { rx: /text-stone-600/g, repl: "text-muted-foreground/60" },
    { rx: /text-stone-700/g, repl: "text-muted-foreground/40" },
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
