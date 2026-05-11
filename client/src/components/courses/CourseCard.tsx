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

// Curated gradient palette — subtle, professional slate/blue hues
const gradients = [
    "linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.05) 100%)",
    "linear-gradient(135deg, rgba(71, 100, 120, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%)",
    "linear-gradient(135deg, rgba(37, 99, 235, 0.1) 0%, rgba(71, 100, 120, 0.05) 100%)",
];

export default function CourseCard({ course, modules, gradientIndex }: CourseCardProps) {
    const gradient = gradients[gradientIndex % gradients.length];

    return (
        <div
            className="
        group relative rounded-2xl overflow-clip
        border border-border hover:border-primary/20
        bg-card backdrop-blur-sm
        transition-all duration-500 ease-out
        hover:shadow-xl hover:shadow-primary/5
        hover:-translate-y-1
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
