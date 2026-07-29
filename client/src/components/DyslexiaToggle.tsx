import { useEffect, useState } from "react";
import { Type } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "dyslexia-font";

/**
 * Toggles a dyslexia-friendly font (OpenDyslexic) app-wide by adding a
 * `dyslexic` class to <html>, which overrides the --font-sans variable.
 * The preference persists in localStorage (also applied in main.tsx pre-render).
 */
export function DyslexiaToggle() {
    const [on, setOn] = useState(false);

    useEffect(() => {
        setOn(document.documentElement.classList.contains("dyslexic"));
    }, []);

    const toggle = () => {
        const next = !on;
        setOn(next);
        document.documentElement.classList.toggle("dyslexic", next);
        try {
            localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
        } catch {
            /* localStorage unavailable */
        }
    };

    return (
        <Button
            variant="outline"
            size="sm"
            onClick={toggle}
            aria-pressed={on}
            className="w-full border-border text-foreground hover:bg-muted gap-2"
            data-testid="toggle-dyslexia-font"
        >
            <Type className="w-4 h-4" />
            {on ? "Standard Font" : "Dyslexia Font"}
        </Button>
    );
}
