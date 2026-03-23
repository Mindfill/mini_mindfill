const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'client/src/index.css');

let content = fs.readFileSync(cssPath, 'utf8');

const newRoot = `:root {
  --button-outline: rgba(0,0,0, .10);
  --badge-outline: rgba(0,0,0, .05);
  --opaque-button-border-intensity: -8;
  --elevate-1: rgba(0,0,0, .03);
  --elevate-2: rgba(0,0,0, .08);

  --background: 60 20% 98%;      /* #FAFAF9 */
  --foreground: 60 3% 6%;        /* #111110 */
  --border: 45 7% 90%;           /* #E7E5E4 */
  --card: 0 0% 100%;             /* #FFFFFF */
  --card-foreground: 60 3% 6%;
  --card-border: 45 7% 90%;
  --sidebar: 60 20% 98%;
  --sidebar-foreground: 60 3% 6%;
  --sidebar-border: 45 7% 90%;
  --sidebar-primary: 32 95% 37%; /* #B45309 */
  --sidebar-primary-foreground: 0 0% 100%;
  --sidebar-accent: 38 92% 50%;
  --sidebar-accent-foreground: 0 0% 100%;
  --sidebar-ring: 38 92% 50%;
  --popover: 0 0% 100%;
  --popover-foreground: 60 3% 6%;
  --popover-border: 45 7% 90%;
  --primary: 32 95% 37%;         /* #B45309 */
  --primary-foreground: 0 0% 100%;
  --secondary: 45 7% 90%;
  --secondary-foreground: 60 3% 6%;
  --muted: 45 7% 94%;
  --muted-foreground: 24 5% 45%; /* #A8A29E */
  --accent: 38 92% 50%;          /* #F59E0B */
  --accent-foreground: 0 0% 100%;
  --destructive: 0 84% 35%;
  --destructive-foreground: 0 84% 98%;
  --input: 45 7% 85%;
  --ring: 38 92% 50%;
  --chart-1: 32 95% 37%;
  --chart-2: 220 90% 35%;
  --chart-3: 280 75% 35%;
  --chart-4: 25 90% 35%;
  --chart-5: 340 85% 35%;

  --font-sans: "Space Grotesk", Inter, sans-serif;
  --font-serif: Georgia, serif;
  --font-mono: Menlo, monospace;
  --radius: .5rem;
  --shadow-2xs: 0px 2px 0px 0px hsl(0 0% 0% / 0.02);
  --shadow-xs: 0px 2px 0px 0px hsl(0 0% 0% / 0.05);
  --shadow-sm: 0px 2px 0px 0px hsl(0 0% 0% / 0.03), 0px 1px 2px -1px hsl(0 0% 0% / 0.08);
  --shadow: 0px 2px 0px 0px hsl(0 0% 0% / 0.04), 0px 1px 2px -1px hsl(0 0% 0% / 0.10);
  --shadow-md: 0px 2px 0px 0px hsl(0 0% 0% / 0.05), 0px 2px 4px -1px hsl(0 0% 0% / 0.12);
  --shadow-lg: 0px 2px 0px 0px hsl(0 0% 0% / 0.06), 0px 4px 6px -1px hsl(0 0% 0% / 0.15);
  --shadow-xl: 0px 2px 0px 0px hsl(0 0% 0% / 0.08), 0px 8px 10px -1px hsl(0 0% 0% / 0.18);
  --shadow-2xl: 0px 2px 0px 0px hsl(0 0% 0% / 0.12);
  --tracking-normal: 0em;
  --spacing: 0.25rem;

  --sidebar-primary-border: hsl(var(--sidebar-primary));
  --sidebar-accent-border: hsl(var(--sidebar-accent));
  --primary-border: hsl(var(--primary));
  --secondary-border: hsl(var(--secondary));
  --muted-border: hsl(var(--muted));
  --accent-border: hsl(var(--accent));
  --destructive-border: hsl(var(--destructive));
}`;

const newDark = `.dark {
  --button-outline: rgba(255,255,255, .10);
  --badge-outline: rgba(255,255,255, .05);
  --opaque-button-border-intensity: 9;
  --elevate-1: rgba(255,255,255, .04);
  --elevate-2: rgba(255,255,255, .09);

  --background: 60 3% 6%;        /* #111110 */
  --foreground: 60 20% 98%;      /* #FAFAF9 */
  --border: 45 7% 16%;           /* #2C2B26 */
  --card: 45 8% 10%;             /* #1C1B18 */
  --card-foreground: 60 20% 98%;
  --card-border: 45 7% 16%;
  --sidebar: 60 3% 6%;
  --sidebar-foreground: 60 20% 98%;
  --sidebar-border: 45 7% 16%;
  --sidebar-primary: 32 95% 37%; /* #B45309 */
  --sidebar-primary-foreground: 60 20% 98%;
  --sidebar-accent: 38 92% 50%;
  --sidebar-accent-foreground: 60 20% 98%;
  --sidebar-ring: 38 92% 50%;
  --popover: 45 8% 10%;
  --popover-foreground: 60 20% 98%;
  --popover-border: 45 7% 16%;
  --primary: 38 92% 50%;         /* #F59E0B -> brighter in dark mode */
  --primary-foreground: 60 3% 6%;
  --secondary: 45 7% 16%;
  --secondary-foreground: 60 20% 98%;
  --muted: 40 10% 12%;           /* #292318 slightly modified for general muted */
  --muted-foreground: 24 5% 64%; /* #A8A29E */
  --accent: 32 95% 37%;          /* #B45309 */
  --accent-foreground: 60 20% 98%;
  --destructive: 0 84% 35%;
  --destructive-foreground: 0 84% 98%;
  --input: 45 7% 16%;
  --ring: 38 92% 50%;
  --chart-1: 38 92% 50%;
  --chart-2: 220 90% 65%;
  --chart-3: 280 75% 65%;
  --chart-4: 25 90% 65%;
  --chart-5: 340 85% 65%;

  --shadow-2xs: 0px 2px 0px 0px hsl(0 0% 0% / 0.20);
  --shadow-xs: 0px 2px 0px 0px hsl(0 0% 0% / 0.30);
  --shadow-sm: 0px 2px 0px 0px hsl(0 0% 0% / 0.25), 0px 1px 2px -1px hsl(0 0% 0% / 0.40);
  --shadow: 0px 2px 0px 0px hsl(0 0% 0% / 0.30), 0px 1px 2px -1px hsl(0 0% 0% / 0.50);
  --shadow-md: 0px 2px 0px 0px hsl(0 0% 0% / 0.35), 0px 2px 4px -1px hsl(0 0% 0% / 0.60);
  --shadow-lg: 0px 2px 0px 0px hsl(0 0% 0% / 0.40), 0px 4px 6px -1px hsl(0 0% 0% / 0.70);
  --shadow-xl: 0px 2px 0px 0px hsl(0 0% 0% / 0.50), 0px 8px 10px -1px hsl(0 0% 0% / 0.80);
  --shadow-2xl: 0px 2px 0px 0px hsl(0 0% 0% / 0.60);

  --sidebar-primary-border: hsl(var(--sidebar-primary));
  --sidebar-accent-border: hsl(var(--sidebar-accent));
  --primary-border: hsl(var(--primary));
  --secondary-border: hsl(var(--secondary));
  --muted-border: hsl(var(--muted));
  --accent-border: hsl(var(--accent));
  --destructive-border: hsl(var(--destructive));
}`;

content = content.replace(/:root\s*\{[\s\S]*?\}\s*\.dark\s*\{[\s\S]*?\}\s*@layer base/m,
    newRoot + "\n\n" + newDark + "\n\n@layer base");

fs.writeFileSync(cssPath, content, 'utf8');
console.log('Updated index.css');
