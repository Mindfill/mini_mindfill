import ModuleAccordion from "./ModuleAccordion";

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

interface CourseCardProps {
    course: {
        id: string;
        title: string;
        slug: string;
    };
    modules: (Module & { lessons: Lesson[] })[];
    gradientIndex: number;
}

// Curated gradient palette — subtle, premium, green-hue anchored
const gradients = [
    "linear-gradient(135deg, rgba(245, 158, 11,0.15) 0%, rgba(0,180,216,0.10) 100%)",
    "linear-gradient(135deg, rgba(245, 158, 11,0.12) 0%, rgba(120,0,255,0.08) 100%)",
    "linear-gradient(135deg, rgba(0,200,100,0.14) 0%, rgba(255,180,0,0.08) 100%)",
    "linear-gradient(135deg, rgba(0,255,180,0.12) 0%, rgba(0,100,255,0.08) 100%)",
    "linear-gradient(135deg, rgba(80,255,120,0.10) 0%, rgba(255,80,200,0.06) 100%)",
];

export default function CourseCard({ course, modules, gradientIndex }: CourseCardProps) {
    const gradient = gradients[gradientIndex % gradients.length];

    return (
        <div
            className="
        group relative rounded-2xl overflow-clip
        border border-border hover:border-primary/30
        bg-card backdrop-blur-sm
        transition-all duration-300 ease-out
        hover:shadow-[0_0_40px_rgba(245, 158, 11,0.06)]
        hover:-translate-y-0.5
      "
            data-testid={`course-${course.slug}`}
        >
            {/* Gradient header */}
            <div
                className="h-2 w-full"
                style={{ background: gradient }}
            />

            {/* Course header */}
            <div className="px-6 pt-5 pb-4">
                <div className="flex items-start gap-3">
                    <div
                        className="
              w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
              text-lg font-bold text-primary
            "
                        style={{ background: gradient }}
                    >
                        {course.title.charAt(0)}
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-foreground tracking-tight leading-tight">
                            {course.title}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                            {modules.length} module{modules.length !== 1 ? "s" : ""} ·{" "}
                            {modules.reduce((sum, m) => sum + m.lessons.length, 0)} lesson
                            {modules.reduce((sum, m) => sum + m.lessons.length, 0) !== 1 ? "s" : ""}
                        </p>
                    </div>
                </div>
            </div>

            {/* Modules list */}
            <div className="border-t border-border">
                {modules.length > 0 ? (
                    modules.map((mod, idx) => (
                        <ModuleAccordion
                            key={mod.id}
                            module={mod}
                            lessons={mod.lessons}
                            defaultOpen={idx === 0}
                        />
                    ))
                ) : (
                    <p className="px-6 py-4 text-sm text-muted-foreground italic">No modules yet</p>
                )}
            </div>
        </div>
    );
}
