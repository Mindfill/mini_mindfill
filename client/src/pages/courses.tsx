import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import AppSidebar from "@/components/sidebar/AppSidebar";
import CourseCard from "@/components/courses/CourseCard";
import mindfillIcon from "/images/mindfill.png";

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
    const [loading, setLoading] = useState(true);
    const [courses, setCourses] = useState<Course[]>([]);
    const [modules, setModules] = useState<Module[]>([]);
    const [lessons, setLessons] = useState<Lesson[]>([]);

    const userName = user?.user_metadata?.full_name || user?.email || "User";

    useEffect(() => {
        if (!authLoading && !session) {
            navigate("/login");
            return;
        }

        if (session) {
            const fetchAllData = async () => {
                setLoading(true);
                // Fetch courses, modules, and lessons in parallel
                const [coursesRes, modulesRes, lessonsRes] = await Promise.all([
                    supabase.from("courses").select("id, title, slug").order("order_index", { ascending: true }),
                    supabase.from("modules").select("id, course_id, title, slug").order("order_index", { ascending: true }),
                    supabase.from("lessons").select("id, module_id, title, slug").order("order_index", { ascending: true }),
                ]);

                if (coursesRes.error) console.error("Courses query error:", coursesRes.error);
                if (modulesRes.error) console.error("Modules query error:", modulesRes.error);
                if (lessonsRes.error) console.error("Lessons query error:", lessonsRes.error);

                if (coursesRes.data) setCourses(coursesRes.data);
                if (modulesRes.data) setModules(modulesRes.data);
                if (lessonsRes.data) setLessons(lessonsRes.data);

                setLoading(false);
            };

            fetchAllData();
        }
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

    if (authLoading || loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="h-[100dvh] w-full bg-background text-foreground flex overflow-hidden">
            <AppSidebar
                userName={userName}
                activeItem="courses"
                onSignOut={handleSignOut}
            />

            {/* Main content */}
            <div className="flex-1 flex flex-col h-full relative overflow-y-auto">
                {/* Top header */}
                <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border">
                    <div className="px-8 py-6">
                        <div className="flex items-center gap-3">
                            <img
                                src={mindfillIcon}
                                alt="TECHCESS"
                                className="w-16 h-16 rounded-2xl object-cover mb-4"
                            />
                            <div>
                                <h1
                                    className="text-2xl font-bold tracking-tight"
                                    style={{ textShadow: "0 0 30px rgba(245, 158, 11, 0.15)" }}
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
                <main className="flex-1 p-8">
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
            </div>
        </div>
    );
}
