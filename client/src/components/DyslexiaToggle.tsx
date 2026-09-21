import { useEffect, useState } from "react";
import { Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { applyDyslexiaFont, isDyslexiaFontOn } from "@/lib/dyslexiaFont";

/**
 * Toggles a dyslexia-friendly font (OpenDyslexic) app-wide by adding a
 * `dyslexic` class to <html>, which overrides the --font-sans variable.
 * The preference persists in localStorage (also applied in main.tsx
 * pre-render). Onboarding asks the same question and stores the answer on the
 * profile so it follows the account — see lib/dyslexiaFont.ts.
 */
export function DyslexiaToggle() {
    const [on, setOn] = useState(false);

    useEffect(() => {
        setOn(isDyslexiaFontOn());
    }, []);

    const toggle = () => {
        const next = !on;
        setOn(next);
        applyDyslexiaFont(next);
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
