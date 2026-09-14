import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useUserProfile } from "@/hooks/use-user-profile";
import AnimatedGradientBg from "@/components/ui/animated-gradient-bg";
import { GlassButton } from "@/components/ui/glass-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
    Loader2, School, Ticket, UserPlus, Power, Upload, FileSpreadsheet,
    CheckCircle2, AlertTriangle, XCircle,
} from "lucide-react";
import {
    fetchAdminSchools,
    createAdminSchool,
    fetchSchoolAdmins,
    assignSchoolAdmin,
    fetchAdminPromoCodes,
    createAdminPromoCode,
    toggleAdminPromoCode,
    importCurriculumContent,
    type AdminSchool,
    type AdminSchoolAdmin,
    type AdminPromoCode,
    type ContentImportReport,
    type ImportIssue,
} from "@/lib/api";

const PLAN_TYPES = [
    "secondary_individual_monthly",
    "secondary_individual_yearly",
    "secondary_family_monthly",
    "secondary_family_yearly",
    "uni_monthly",
    "uni_yearly",
    "pilot",
];

function SchoolsPanel({ accessToken }: { accessToken: string }) {
    const { toast } = useToast();
    const [schools, setSchools] = useState<AdminSchool[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [schoolName, setSchoolName] = useState("");
    const [city, setCity] = useState("");
    const [state, setState] = useState("");
    const [contactEmail, setContactEmail] = useState("");

    const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);
    const [admins, setAdmins] = useState<AdminSchoolAdmin[]>([]);
    const [adminsLoading, setAdminsLoading] = useState(false);
    const [assignEmail, setAssignEmail] = useState("");
    const [assigning, setAssigning] = useState(false);

    const loadSchools = async () => {
        setLoading(true);
        try {
            setSchools(await fetchAdminSchools(accessToken));
        } catch (err) {
            console.error(err);
            toast({ variant: "destructive", title: "Couldn't load schools" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSchools();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadAdmins = async (schoolId: string) => {
        setSelectedSchoolId(schoolId);
        setAdminsLoading(true);
        try {
            setAdmins(await fetchSchoolAdmins(schoolId, accessToken));
        } catch (err) {
            console.error(err);
            toast({ variant: "destructive", title: "Couldn't load school admins" });
        } finally {
            setAdminsLoading(false);
        }
    };

    const handleCreateSchool = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!schoolName.trim() || creating) return;
        setCreating(true);
        try {
            await createAdminSchool(
                { school_name: schoolName.trim(), city: city.trim() || undefined, state: state.trim() || undefined, contact_email: contactEmail.trim() || undefined },
                accessToken
            );
            toast({ title: "School created" });
            setSchoolName("");
            setCity("");
            setState("");
            setContactEmail("");
            loadSchools();
        } catch (err) {
            console.error(err);
            toast({ variant: "destructive", title: "Couldn't create school" });
        } finally {
            setCreating(false);
        }
    };

    const handleAssignAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSchoolId || !assignEmail.trim() || assigning) return;
        setAssigning(true);
        try {
            await assignSchoolAdmin(selectedSchoolId, assignEmail.trim(), accessToken);
            toast({ title: "School admin assigned" });
            setAssignEmail("");
            loadAdmins(selectedSchoolId);
        } catch (err: any) {
            console.error(err);
            toast({
                variant: "destructive",
                title: "Couldn't assign admin",
                description: err?.message?.includes("404") ? "No account found with that email — they must sign up first." : "Please try again.",
            });
        } finally {
            setAssigning(false);
        }
    };

    return (
        <div className="space-y-6">
            <form onSubmit={handleCreateSchool} className="glass-panel rounded-2xl p-6 space-y-4">
                <h3 className="font-semibold flex items-center gap-2"><School className="w-4 h-4" /> New School</h3>
                <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label>School Name</Label>
                        <Input value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder="e.g., Lagos Model College" />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Contact Email</Label>
                        <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="contact@school.edu.ng" />
                    </div>
                    <div className="space-y-1.5">
                        <Label>City</Label>
                        <Input value={city} onChange={(e) => setCity(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <Label>State</Label>
                        <Input value={state} onChange={(e) => setState(e.target.value)} />
                    </div>
                </div>
                <GlassButton type="submit" disabled={creating || !schoolName.trim()} contentClassName="flex items-center gap-2">
                    {creating && <Loader2 className="w-4 h-4 animate-spin" />} Create School
                </GlassButton>
            </form>

            <div className="glass-panel rounded-2xl p-6">
                <h3 className="font-semibold mb-4">Schools</h3>
                {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                ) : schools.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No schools yet.</p>
                ) : (
                    <div className="space-y-2">
                        {schools.map((s) => (
                            <div key={s.id}>
                                <button
                                    onClick={() => loadAdmins(s.id)}
                                    className={`w-full text-left p-3 rounded-xl border transition-colors ${selectedSchoolId === s.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted"}`}
                                >
                                    <span className="font-medium">{s.school_name}</span>
                                    {s.city && <span className="text-muted-foreground text-sm ml-2">{s.city}{s.state ? `, ${s.state}` : ""}</span>}
                                </button>

                                {selectedSchoolId === s.id && (
                                    <div className="mt-2 ml-3 p-4 rounded-xl bg-muted/50 space-y-3">
                                        {adminsLoading ? (
                                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                        ) : admins.length > 0 ? (
                                            <ul className="text-sm space-y-1">
                                                {admins.map((a) => (
                                                    <li key={a.user_id} className="text-muted-foreground">{a.full_name || a.user_id}</li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p className="text-muted-foreground text-sm">No admins assigned yet.</p>
                                        )}
                                        <form onSubmit={handleAssignAdmin} className="flex gap-2">
                                            <Input
                                                type="email"
                                                value={assignEmail}
                                                onChange={(e) => setAssignEmail(e.target.value)}
                                                placeholder="admin@school.edu.ng"
                                                className="flex-1"
                                            />
                                            <GlassButton type="submit" size="sm" disabled={assigning || !assignEmail.trim()} contentClassName="flex items-center gap-1.5">
                                                {assigning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                                                Assign
                                            </GlassButton>
                                        </form>
                                        <p className="text-xs text-muted-foreground">The admin must already have a Techcess account — ask them to sign up first.</p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function PromoCodesPanel({ accessToken }: { accessToken: string }) {
    const { toast } = useToast();
    const [codes, setCodes] = useState<AdminPromoCode[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [code, setCode] = useState("");
    const [planType, setPlanType] = useState(PLAN_TYPES[0]);
    const [accessDays, setAccessDays] = useState("30");
    const [maxUses, setMaxUses] = useState("");

    const loadCodes = async () => {
        setLoading(true);
        try {
            setCodes(await fetchAdminPromoCodes(accessToken));
        } catch (err) {
            console.error(err);
            toast({ variant: "destructive", title: "Couldn't load promo codes" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCodes();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!code.trim() || !accessDays || creating) return;
        setCreating(true);
        try {
            await createAdminPromoCode(
                {
                    code: code.trim().toUpperCase(),
                    plan_type: planType,
                    access_days: parseInt(accessDays, 10),
                    max_uses: maxUses ? parseInt(maxUses, 10) : undefined,
                },
                accessToken
            );
            toast({ title: "Promo code created" });
            setCode("");
            setMaxUses("");
            loadCodes();
        } catch (err) {
            console.error(err);
            toast({ variant: "destructive", title: "Couldn't create promo code" });
        } finally {
            setCreating(false);
        }
    };

    const handleToggle = async (id: string) => {
        try {
            await toggleAdminPromoCode(id, accessToken);
            loadCodes();
        } catch (err) {
            console.error(err);
            toast({ variant: "destructive", title: "Couldn't update promo code" });
        }
    };

    return (
        <div className="space-y-6">
            <form onSubmit={handleCreate} className="glass-panel rounded-2xl p-6 space-y-4">
                <h3 className="font-semibold flex items-center gap-2"><Ticket className="w-4 h-4" /> New Promo Code</h3>
                <div className="grid md:grid-cols-4 gap-4">
                    <div className="space-y-1.5">
                        <Label>Code</Label>
                        <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="PILOT2026" />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Plan</Label>
                        <select
                            value={planType}
                            onChange={(e) => setPlanType(e.target.value)}
                            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                        >
                            {PLAN_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Access Days</Label>
                        <Input type="number" value={accessDays} onChange={(e) => setAccessDays(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Max Uses (optional)</Label>
                        <Input type="number" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder="Unlimited" />
                    </div>
                </div>
                <GlassButton type="submit" disabled={creating || !code.trim()} contentClassName="flex items-center gap-2">
                    {creating && <Loader2 className="w-4 h-4 animate-spin" />} Create Code
                </GlassButton>
            </form>

            <div className="glass-panel rounded-2xl overflow-hidden">
                <h3 className="font-semibold p-6 pb-4">Promo Codes</h3>
                {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground ml-6 mb-6" />
                ) : codes.length === 0 ? (
                    <p className="text-muted-foreground text-sm px-6 pb-6">No promo codes yet.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-muted-foreground text-xs uppercase tracking-wider border-b border-border/50">
                                    <th className="px-6 py-2 font-medium">Code</th>
                                    <th className="px-6 py-2 font-medium">Plan</th>
                                    <th className="px-6 py-2 font-medium">Uses</th>
                                    <th className="px-6 py-2 font-medium">Status</th>
                                    <th className="px-6 py-2 font-medium"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {codes.map((c) => (
                                    <tr key={c.id} className="border-b border-border/30 last:border-0">
                                        <td className="px-6 py-3 font-mono font-medium">{c.code}</td>
                                        <td className="px-6 py-3 text-muted-foreground">{c.plan_type}</td>
                                        <td className="px-6 py-3 text-muted-foreground">{c.uses_count}{c.max_uses ? ` / ${c.max_uses}` : ""}</td>
                                        <td className="px-6 py-3">
                                            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${c.is_active ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                                                {c.is_active ? "Active" : "Inactive"}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3">
                                            <button onClick={() => handleToggle(c.id)} className="text-muted-foreground hover:text-foreground transition-colors" title="Toggle active">
                                                <Power className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

const ENTITY_LABEL: Record<string, string> = {
    chapters: "Chapters",
    sections: "Sections",
    subsections: "Subsections",
    problems: "Questions",
};

function IssueList({ title, issues, tone }: { title: string; issues: ImportIssue[]; tone: "reject" | "skip" }) {
    if (issues.length === 0) return null;
    const colour = tone === "reject" ? "text-red-600 dark:text-red-400" : "text-muted-foreground";
    return (
        <div>
            <h4 className={`text-xs font-semibold uppercase tracking-wider mb-2 ${colour}`}>
                {title} ({issues.length})
            </h4>
            <div className="max-h-60 overflow-y-auto rounded-xl border border-border/50 divide-y divide-border/30">
                {issues.map((issue, i) => (
                    <div key={`${issue.entity}-${issue.row}-${i}`} className="px-3 py-2 text-xs">
                        <span className="font-mono text-foreground/80">
                            {issue.id || `row ${issue.row}`}
                        </span>
                        {issue.row && issue.id && (
                            <span className="text-muted-foreground"> · row {issue.row}</span>
                        )}
                        <p className="text-muted-foreground mt-0.5">{issue.reason}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

function ContentPanel({ accessToken }: { accessToken: string }) {
    const [file, setFile] = useState<File | null>(null);
    const [busy, setBusy] = useState<"dry" | "live" | null>(null);
    const [report, setReport] = useState<ContentImportReport | null>(null);
    const { toast } = useToast();

    // A live import is only offered after a dry run of the same file came back
    // clean of rejections — it's the one guard against writing known-bad rows.
    const dryRunClean =
        report !== null && report.dry_run && report.rejected.length === 0;

    const run = async (dryRun: boolean) => {
        if (!file) return;
        setBusy(dryRun ? "dry" : "live");
        try {
            const result = await importCurriculumContent(file, dryRun, accessToken);
            setReport(result);
            if (!dryRun) {
                toast({
                    title: "Content imported",
                    description: "The curriculum tables have been updated.",
                });
            }
        } catch (err) {
            toast({
                title: dryRun ? "Validation failed" : "Import failed",
                description: err instanceof Error ? err.message : "Something went wrong.",
                variant: "destructive",
            });
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="glass-panel rounded-2xl p-6">
                <h3 className="font-semibold mb-1">Curriculum content</h3>
                <p className="text-sm text-muted-foreground mb-5">
                    Upload the authoring workbook (.xlsx). Check it first — nothing is written
                    until you import. Re-importing a corrected workbook updates the existing
                    rows rather than duplicating them.
                </p>

                <label className="flex items-center gap-3 px-4 py-4 rounded-xl border border-dashed border-border cursor-pointer hover:bg-card/50 transition-colors">
                    <FileSpreadsheet className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-sm truncate">
                        {file ? file.name : "Choose a workbook…"}
                        {file && (
                            <span className="block text-xs text-muted-foreground">
                                saved {new Date(file.lastModified).toLocaleString()}
                            </span>
                        )}
                    </span>
                    <input
                        type="file"
                        accept=".xlsx"
                        className="hidden"
                        onChange={(e) => {
                            setFile(e.target.files?.[0] ?? null);
                            setReport(null);
                        }}
                        data-testid="input-content-file"
                    />
                </label>

                <div className="flex flex-wrap gap-3 mt-4">
                    <GlassButton
                        onClick={() => run(true)}
                        disabled={!file || busy !== null}
                        data-testid="button-content-check"
                    >
                        {busy === "dry" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        Check file
                    </GlassButton>
                    <GlassButton
                        onClick={() => run(false)}
                        disabled={!file || busy !== null || !dryRunClean}
                        data-testid="button-content-import"
                    >
                        {busy === "live" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        Import
                    </GlassButton>
                </div>
                {report?.dry_run && !dryRunClean && (
                    <p className="text-xs text-muted-foreground mt-3">
                        Fix the rejected rows below and check the file again to enable importing.
                    </p>
                )}
            </div>

            {report && (
                <div className="glass-panel rounded-2xl p-6 space-y-5">
                    <div className="flex items-center gap-2">
                        {report.dry_run ? (
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                        ) : (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        )}
                        <h3 className="font-semibold">
                            {report.dry_run ? "Checked — this is what Import will do" : "Imported"}
                        </h3>
                    </div>
                    {report.dry_run && (
                        <p className="text-xs text-muted-foreground -mt-3">
                            Nothing has been written to the database yet. These counts describe the
                            workbook, so editing the text inside a row won't change them — an edited
                            row still shows under "updated", and its new content lands when you import.
                        </p>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {Object.entries(report.counts).map(([entity, c]) => (
                            <div key={entity} className="glass-chip rounded-xl p-3">
                                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                                    {ENTITY_LABEL[entity] ?? entity}
                                </p>
                                <p className="text-xl font-bold">{c.created_or_updated}</p>
                                <p className="text-xs text-muted-foreground">
                                    {c.new} new · {c.updated} updated
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {c.skipped > 0 ? `${c.skipped} to author` : "all rows read"}
                                    {c.rejected > 0 && (
                                        <span className="text-red-600 dark:text-red-400"> · {c.rejected} rejected</span>
                                    )}
                                </p>
                            </div>
                        ))}
                    </div>

                    {report.warnings.length > 0 && (
                        <div>
                            <h4 className="text-xs font-semibold uppercase tracking-wider mb-2 text-amber-600 dark:text-amber-400">
                                Warnings ({report.warnings.length})
                            </h4>
                            <ul className="space-y-1.5">
                                {report.warnings.map((w, i) => (
                                    <li key={i} className="text-xs text-muted-foreground flex gap-2">
                                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                                        {w}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <IssueList title="Rejected — fix these" issues={report.rejected} tone="reject" />
                    <IssueList title="Not authored yet — skipped" issues={report.skipped} tone="skip" />

                    <p className="text-xs text-muted-foreground font-mono">
                        received {report.file_bytes.toLocaleString()} bytes · {report.file_sha256}
                    </p>
                    {Object.keys(report.blank_rows).length > 0 && (
                        <p className="text-xs text-muted-foreground flex items-center gap-2">
                            <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
                            Ignored empty rows:{" "}
                            {Object.entries(report.blank_rows)
                                .map(([e, n]) => `${n} in ${ENTITY_LABEL[e] ?? e}`)
                                .join(", ")}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}

export default function Admin() {
    const { session, isLoading: authLoading } = useAuth();
    const { role, loading: profileLoading } = useUserProfile();
    const [, navigate] = useLocation();
    const [tab, setTab] = useState<"schools" | "promo" | "content">("schools");

    useEffect(() => {
        if (!authLoading && !session) navigate("/login");
    }, [authLoading, session, navigate]);

    useEffect(() => {
        if (!authLoading && session && !profileLoading && role && role !== "admin") {
            navigate("/dashboard");
        }
    }, [authLoading, session, profileLoading, role, navigate]);

    useEffect(() => {
        document.title = "Admin | TECHCESS";
    }, []);

    if (authLoading || !session || profileLoading || role !== "admin") return null;

    return (
        <div className="min-h-screen w-full bg-background text-foreground relative">
            <AnimatedGradientBg />
            <main className="max-w-4xl mx-auto p-6 md:p-10 space-y-8 relative">
                <div>
                    <h1 className="font-display text-2xl font-semibold tracking-tight">Admin</h1>
                    <p className="text-muted-foreground text-sm">Schools, school admins, promo codes, and curriculum content.</p>
                </div>

                <div className="flex items-center glass-chip rounded-full p-1 w-fit">
                    <button
                        onClick={() => setTab("schools")}
                        className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${tab === "schools" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                        Schools
                    </button>
                    <button
                        onClick={() => setTab("promo")}
                        className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${tab === "promo" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                        Promo Codes
                    </button>
                    <button
                        onClick={() => setTab("content")}
                        className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${tab === "content" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                        Content
                    </button>
                </div>

                {tab === "schools" && <SchoolsPanel accessToken={session.access_token} />}
                {tab === "promo" && <PromoCodesPanel accessToken={session.access_token} />}
                {tab === "content" && <ContentPanel accessToken={session.access_token} />}
            </main>
        </div>
    );
}
