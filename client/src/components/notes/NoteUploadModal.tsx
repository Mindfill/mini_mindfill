import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { uploadNote, fetchCourses, createCourse, Course } from "@/lib/api";
import { X, Upload, FileText, CheckCircle2, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface NoteUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUploadSuccess: () => void;
}

export default function NoteUploadModal({ isOpen, onClose, onUploadSuccess }: NoteUploadModalProps) {
    const { session } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [step, setStep] = useState<"upload" | "processing" | "success">("upload");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [title, setTitle] = useState("");
    const [courseId, setCourseId] = useState<string>("");
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showCreateCourse, setShowCreateCourse] = useState(false);
    const [newCourseName, setNewCourseName] = useState("");
    const [newCourseCode, setNewCourseCode] = useState("");
    const [newCourseDescription, setNewCourseDescription] = useState("");
    const [creatingCourse, setCreatingCourse] = useState(false);

    const resetState = () => {
        setStep("upload");
        setSelectedFile(null);
        setTitle("");
        setCourseId("");
        setError(null);
        setLoading(false);
        setShowCreateCourse(false);
        setNewCourseName("");
        setNewCourseCode("");
        setNewCourseDescription("");
        setCreatingCourse(false);
    };

    const handleCreateCourse = async () => {
        if (!session || !newCourseName) return;

        setCreatingCourse(true);
        setError(null);

        try {
            const newCourse = await createCourse(
                { name: newCourseName, course_code: newCourseCode, description: newCourseDescription },
                session.access_token
            );
            
            // Reload courses to get the fresh list from server
            const refreshedCourses = await fetchCourses(session.access_token);
            setCourses(refreshedCourses);
            
            // Automatically select the new course
            if (newCourse.id) {
                setCourseId(newCourse.id);
            } else {
                // If id isn't in response, try to find it in fresh list
                const found = refreshedCourses.find(c => c.name === newCourseName);
                if (found && found.id) {
                    setCourseId(found.id);
                }
            }
            
            setShowCreateCourse(false);
            setNewCourseName("");
            setNewCourseCode("");
            setNewCourseDescription("");
        } catch (err: any) {
            console.error("Failed to create course:", err);
            setError(err.message || "Failed to create course");
        } finally {
            setCreatingCourse(false);
        }
    };

    const handleClose = () => {
        resetState();
        onClose();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.type !== "application/pdf") {
                setError("Only PDF files are accepted");
                return;
            }
            setSelectedFile(file);
            if (!title) {
                // Set default title from filename without extension
                setTitle(file.name.replace(/\.pdf$/i, ""));
            }
            setError(null);
        }
    };

    const loadCourses = async () => {
        if (!session) return;
        try {
            const coursesData = await fetchCourses(session.access_token);
            setCourses(coursesData);
        } catch (err) {
            console.error("Failed to load courses:", err);
        }
    };

    useEffect(() => {
        if (isOpen) {
            loadCourses();
        }
    }, [isOpen, session]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedFile || !title || !session) return;

        setLoading(true);
        setError(null);
        setStep("processing");

        try {
            await uploadNote(
                selectedFile,
                title,
                courseId || undefined,
                session.access_token
            );
            setStep("success");
            setTimeout(() => {
                handleClose();
                onUploadSuccess();
            }, 1500);
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Failed to upload note");
            setStep("upload");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-background border border-border rounded-3xl max-w-lg w-full shadow-xl">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <h2 className="text-xl font-semibold">
                        {step === "success" ? "Note Uploaded!" : "Upload Note"}
                    </h2>
                    <button
                        onClick={handleClose}
                        className="p-2 rounded-lg hover:bg-muted transition-colors"
                    >
                        <X className="w-5 h-5 text-muted-foreground" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {showCreateCourse ? (
                        <div className="space-y-5">
                            <h3 className="text-lg font-semibold">Create New Course</h3>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="course-name">Course Name *</Label>
                                    <Input
                                        id="course-name"
                                        value={newCourseName}
                                        onChange={(e) => setNewCourseName(e.target.value)}
                                        placeholder="e.g., Calculus I"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="course-code">Course Code (Optional)</Label>
                                    <Input
                                        id="course-code"
                                        value={newCourseCode}
                                        onChange={(e) => setNewCourseCode(e.target.value)}
                                        placeholder="e.g., MATH 101"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="course-description">Description (Optional)</Label>
                                    <Input
                                        id="course-description"
                                        value={newCourseDescription}
                                        onChange={(e) => setNewCourseDescription(e.target.value)}
                                        placeholder="e.g., Introduction to differential and integral calculus"
                                    />
                                </div>
                            </div>
                            {error && (
                                <div className="p-4 rounded-xl bg-destructive/10 text-destructive text-sm">
                                    {error}
                                </div>
                            )}
                            <div className="pt-2 flex gap-3">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    className="flex-1"
                                    onClick={() => {
                                        setShowCreateCourse(false);
                                        setError(null);
                                        setNewCourseName("");
                                        setNewCourseCode("");
                                        setNewCourseDescription("");
                                    }}
                                    disabled={creatingCourse}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="button"
                                    className="flex-1"
                                    onClick={handleCreateCourse}
                                    disabled={!newCourseName || creatingCourse}
                                >
                                    {creatingCourse ? (
                                        <div className="flex items-center gap-2">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Creating...
                                        </div>
                                    ) : (
                                        "Create Course"
                                    )}
                                </Button>
                            </div>
                        </div>
                    ) : step === "success" ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                                <CheckCircle2 className="w-8 h-8 text-primary" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold mb-2">Note Uploaded Successfully!</h3>
                                <p className="text-muted-foreground text-sm">
                                    Your note is being processed and will be ready shortly.
                                </p>
                            </div>
                        </div>
                    ) : step === "processing" ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold mb-2">Processing Your Note...</h3>
                                <p className="text-muted-foreground text-sm">
                                    Extracting text and preparing your learning experience.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* File Upload */}
                            <div className="space-y-2">
                                <Label>PDF File</Label>
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all hover:border-primary/50 ${
                                        selectedFile ? "border-primary/30 bg-primary/5" : "border-border"
                                    }`}
                                >
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="application/pdf"
                                        onChange={handleFileChange}
                                        className="hidden"
                                    />
                                    {selectedFile ? (
                                        <div className="flex flex-col items-center gap-2">
                                            <FileText className="w-10 h-10 text-primary" />
                                            <div>
                                                <p className="font-medium">{selectedFile.name}</p>
                                                <p className="text-muted-foreground text-xs">
                                                    {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-2">
                                            <Upload className="w-10 h-10 text-muted-foreground" />
                                            <div>
                                                <p className="font-medium text-muted-foreground">Click to upload PDF</p>
                                                <p className="text-muted-foreground text-xs">or drag and drop</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Title Input */}
                            <div className="space-y-2">
                                <Label htmlFor="note-title">Note Title</Label>
                                <Input
                                    id="note-title"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g., Calculus Chapter 3 Notes"
                                    required
                                />
                            </div>

                            {/* Course Select (Optional) */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="note-course">Course (Optional)</Label>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        className="h-8 text-xs"
                                        onClick={() => setShowCreateCourse(true)}
                                    >
                                        <Plus className="w-3 h-3 mr-1" />
                                        Create Course
                                    </Button>
                                </div>
                                <Select value={courseId} onValueChange={setCourseId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a course..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {courses.length > 0 ? (
                                            courses.map((course) => (
                                                <SelectItem key={course.id} value={course.id!}>
                                                    {course.name}
                                                </SelectItem>
                                            ))
                                        ) : null}
                                    </SelectContent>
                                </Select>
                            </div>

                            {error && (
                                <div className="p-4 rounded-xl bg-destructive/10 text-destructive text-sm">
                                    {error}
                                </div>
                            )}

                            <div className="pt-2 flex gap-3">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    className="flex-1"
                                    onClick={handleClose}
                                    disabled={loading}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    className="flex-1"
                                    disabled={!selectedFile || !title || loading}
                                >
                                    {loading ? (
                                        <div className="flex items-center gap-2">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Uploading...
                                        </div>
                                    ) : (
                                        "Upload Note"
                                    )}
                                </Button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
