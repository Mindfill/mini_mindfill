interface WelcomeHeaderProps {
    name: string;
    subtitle?: string;
}

export default function WelcomeHeader({ name, subtitle }: WelcomeHeaderProps) {
    return (
        <div>
            <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight">
                Welcome back, {name}
            </h1>
            {subtitle && <p className="text-muted-foreground text-sm mt-1.5">{subtitle}</p>}
        </div>
    );
}
