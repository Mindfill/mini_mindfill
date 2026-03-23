import { useState } from "react";
import { ChevronDown } from "lucide-react";
import LessonRow from "./LessonRow";

interface Lesson {
    id: string;
    title: string;
    slug: string;
}

interface Module {
    id: string;
    title: string;
    slug: string;
}

interface ModuleAccordionProps {
    module: Module;
    lessons: Lesson[];
    defaultOpen?: boolean;
}

export default function ModuleAccordion({ module, lessons, defaultOpen = false }: ModuleAccordionProps) {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <div className="border-b border-border last:border-b-0">
            <button
                onClick={() => setOpen(!open)}
                className="
          sticky top-[89px] z-10 bg-background/90 backdrop-blur-md
          w-full flex items-center justify-between px-5 py-4
          text-sm font-semibold text-foreground hover:text-foreground
          transition-colors duration-200 text-left
        "
                data-testid={`module-${module.slug}`}
            >
                <span className="flex items-center gap-3">
                    <span
                        className={`
              w-2 h-2 rounded-full transition-colors duration-200
              ${open ? "bg-primary" : "bg-white/30"}
            `}
                    />
                    {module.title}
                </span>
                <ChevronDown
                    className={`
            w-4 h-4 text-muted-foreground transition-transform duration-300
            ${open ? "rotate-180" : "rotate-0"}
          `}
                />
            </button>

            <div
                className={`
          grid transition-all duration-300 ease-in-out
          ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}
        `}
            >
                <div className="overflow-hidden">
                    <div className="px-3 pb-3 space-y-0.5">
                        {lessons.length > 0 ? (
                            lessons.map((lesson) => (
                                <LessonRow key={lesson.id} lesson={lesson} />
                            ))
                        ) : (
                            <p className="px-4 py-3 text-xs text-muted-foreground italic">No lessons yet</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
