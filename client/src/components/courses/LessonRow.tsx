import { ChevronRight } from "lucide-react";
import { useLocation } from "wouter";

interface Lesson {
    id: string;
    title: string;
    slug: string;
}

interface LessonRowProps {
    lesson: Lesson;
}

export default function LessonRow({ lesson }: LessonRowProps) {
    const [, navigate] = useLocation();

    return (
        <button
            onClick={() => navigate(`/lessons/${lesson.slug}`)}
            className="
        w-full flex items-center justify-between px-4 py-3 rounded-lg
        text-sm text-muted-foreground hover:text-primary hover:bg-card
        transition-all duration-200 group text-left
      "
            data-testid={`lesson-${lesson.slug}`}
        >
            <span className="flex items-center gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-muted group-hover:bg-primary transition-colors duration-200" />
                {lesson.title}
            </span>
            <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
        </button>
    );
}
