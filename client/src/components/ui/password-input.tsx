import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * A password field with a show/hide toggle.
 *
 * Takes everything Input does except `type`, which it owns. Visibility is
 * local to the field and always starts hidden, including after a re-render
 * that swaps the form's mode — a password left revealed on screen is the thing
 * the masking exists to prevent.
 */
const PasswordInput = React.forwardRef<
    HTMLInputElement,
    Omit<React.ComponentProps<"input">, "type">
>(({ className, disabled, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);

    return (
        <div className="relative">
            <Input
                {...props}
                ref={ref}
                type={visible ? "text" : "password"}
                disabled={disabled}
                // Room for the toggle, so a long password never runs under it.
                className={cn("pr-10", className)}
            />
            <button
                type="button"
                // type="button" matters: inside a form, a bare <button> submits
                // it, so revealing the password would fire a sign-in attempt.
                onClick={() => setVisible((v) => !v)}
                disabled={disabled}
                aria-label={visible ? "Hide password" : "Show password"}
                aria-pressed={visible}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-md disabled:cursor-not-allowed disabled:opacity-50"
            >
                {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
        </div>
    );
});
PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
