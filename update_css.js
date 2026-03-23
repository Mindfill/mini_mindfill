import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cssPath = path.join(__dirname, 'client/src/index.css');

let content = fs.readFileSync(cssPath, 'utf8');

// Primary / 31% => Amber 700 (32 95% 37%)
content = content.replace(/158 100% 31%/g, "32 95% 37%");

// Ring / 50% => Amber 400 (38 92% 50%)
content = content.replace(/158 100% 50%/g, "38 92% 50%");

// other accents
content = content.replace(/158 15% 92%/g, "32 20% 90%");
content = content.replace(/158 15% 15%/g, "32 20% 15%");
content = content.replace(/158 8% 93%/g, "32 10% 90%");
content = content.replace(/158 8% 40%/g, "32 10% 40%");
content = content.replace(/158 12% 94%/g, "32 15% 90%");
content = content.replace(/158 12% 15%/g, "32 15% 15%");
content = content.replace(/158 15% 8%/g, "32 15% 10%");
content = content.replace(/158 15% 85%/g, "32 15% 80%");
content = content.replace(/158 6% 10%/g, "32 10% 10%");
content = content.replace(/158 6% 70%/g, "32 10% 70%");
content = content.replace(/158 10% 12%/g, "32 10% 12%");
content = content.replace(/158 10% 92%/g, "32 10% 90%");

fs.writeFileSync(cssPath, content, 'utf8');
console.log('Updated index.css');
