import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import AppSidebar from "@/components/sidebar/AppSidebar";
import AnimatedGradientBg from "@/components/ui/animated-gradient-bg";
import TechcessLoader from "@/components/brand/TechcessLoader";
import PageFade from "@/components/ui/page-fade";
import { useCourseCatalogue } from "@/lib/appQueries";
import CourseCard from "@/components/courses/CourseCard";
import mindfillIcon from "@/assets/mindfill.png";

interface Course {
    id: string;
    title: string;
    slug: string;
}

interface Module {
    id: string;
    course_id: string;
    title: string;
    slug: string;
}

interface Lesson {
    id: string;
    module_id: string;
    title: string;
    slug: string;
}

interface GroupedModule extends Module {
    lessons: Lesson[];
}

export default function Courses() {
    const { session, user, isLoading: authLoading, signOut: supabaseSignOut } = useAuth();
    const [, navigate] = useLocation();
    const userName = user?.user_metadata?.full_name || user?.email || "User";

    // Cached (lib/appQueries.ts): the catalogue is the same for everyone and
    // barely changes, so coming back from a lesson is instant.
    const { data, isPending } = useCourseCatalogue();
    const courses: Course[] = data?.courses ?? [];
    const modules: Module[] = data?.modules ?? [];
    const lessons: Lesson[] = data?.lessons ?? [];
    const loading = isPending && !data;

    useEffect(() => {
        if (!authLoading && !session) navigate("/login");
    }, [session, authLoading, navigate]);

    const handleSignOut = async () => {
        await supabaseSignOut();
        navigate("/login");
    };

    // Group modules under courses, lessons under modules
    const getGroupedModules = (courseId: string): GroupedModule[] => {
        return modules
            .filter((m: Module) => m.course_id === courseId)
            .map((mod: Module) => ({
                ...mod,
                lessons: lessons.filter((l: Lesson) => l.module_id === mod.id),
            }));
    };

    if (authLoading || loading) return <TechcessLoader fullScreen />;

    return (
        <div className="h-[100dvh] w-full bg-background text-foreground flex flex-col md:flex-row overflow-hidden relative">
            <AnimatedGradientBg />
            <AppSidebar
                userName={userName}
                activeItem="courses"
                onSignOut={handleSignOut}
            />

            {/* Main content */}
            <div className="flex-1 flex flex-col h-full relative overflow-y-auto">
                {/* Top header */}
                <header className="sticky top-0 z-20 glass-chip border-b border-border/50">
                    <div className="px-8 py-6">
                        <div className="flex items-center gap-3">
                            <img
                                src={mindfillIcon}
                                alt="TECHCESS"
                                className="w-16 h-16 rounded-2xl object-cover mb-4"
                            />
                            <div>
                                <h1
                                    className="font-display text-2xl font-bold tracking-tight"
                                    style={{ textShadow: "0 0 30px rgba(37, 130, 224, 0.15)" }}
                                >
                                    Courses
                                </h1>
                                <p className="text-sm text-muted-foreground mt-0.5">
                                    Explore your learning path
                                </p>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Course grid */}
                <PageFade className="flex-1 flex flex-col">
                <main className="flex-1 p-8 relative">
                    {courses.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <img
                                src={mindfillIcon}
                                alt="TECHCESS"
                                className="w-16 h-16 rounded-2xl object-cover mb-4"
                            />
                            <p className="text-muted-foreground text-lg">No courses available yet</p>
                            <p className="text-white/25 text-sm mt-1">
                                Check back soon for new content
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-6 max-w-5xl">
                            {courses.map((course: Course, idx: number) => (
                                <CourseCard
                                    key={course.id}
                                    course={course}
                                    modules={getGroupedModules(course.id)}
                                    gradientIndex={idx}
                                />
                            ))}
                        </div>
                    )}
                </main>
                </PageFade>
            </div>
        </div>
    );
}
