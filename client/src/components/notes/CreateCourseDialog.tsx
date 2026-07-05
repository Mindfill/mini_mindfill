import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { createCourse, type Course } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

interface CreateCourseDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated: (course: Course) => void;
}

/** Standalone dialog for creating a course (independent of note upload). */
export default function CreateCourseDialog({ isOpen, onClose, onCreated }: CreateCourseDialogProps) {
    const { session } = useAuth();
    const [name, setName] = useState("");
    const [code, setCode] = useState("");
    const [description, setDescription] = useState("");
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const reset = () => {
        setName("");
        setCode("");
        setDescription("");
        setError(null);
        setCreating(false);
    };

    const handleClose = () => {
        reset();
        onClose();
    };

    const handleCreate = async () => {
        if (!session || !name.trim()) return;
        setCreating(true);
        setError(null);
        try {
            const course = await createCourse(
                {
                    name: name.trim(),
                    course_code: code.trim() || undefined,
                    description: description.trim() || undefined,
                },
                session.access_token
            );
            reset();
            onCreated(course);
        } catch (err: any) {
            console.error("Failed to create course:", err);
            setError(err.message || "Failed to create course");
        } finally {
            setCreating(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="sm:max-w-[425px] bg-background border-border text-foreground">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold text-foreground">
                        Create <span className="text-primary">Course</span>
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        Group your notes under a course to keep things organized.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                        <Label htmlFor="cc-name">Course Name *</Label>
                        <Input
                            id="cc-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., Applied Mechanics"
                            disabled={creating}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="cc-code">Course Code (Optional)</Label>
                        <Input
                            id="cc-code"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            placeholder="e.g., MCE 211"
                            disabled={creating}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="cc-desc">Description (Optional)</Label>
                        <Input
                            id="cc-desc"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Short description"
                            disabled={creating}
                        />
                    </div>

                    {error && (
                        <div className="p-4 rounded-xl bg-destructive/10 text-destructive text-sm">{error}</div>
                    )}

                    <div className="pt-2 flex gap-3 justify-end">
                        <Button type="button" variant="secondary" onClick={handleClose} disabled={creating}>
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={handleCreate}
                            disabled={!name.trim() || creating}
                            className="gap-2"
                        >
                            {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                            Create Course
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
