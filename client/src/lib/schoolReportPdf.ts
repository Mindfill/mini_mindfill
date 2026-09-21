import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { SchoolDashboardResponse, StudentRow } from "@/lib/api";

/**
 * The school admin's monthly report as a designed, printable A4 PDF.
 *
 * This replaced a raw CSV dump. A CSV cannot carry any formatting at all, so
 * the report a head teacher circulated to their board was an unstyled grid of
 * quoted strings. Everything here is drawn from the same
 * /school/report/monthly payload the dashboard already fetches — no new
 * endpoint, and no data the admin can't already see on screen.
 *
 * Kept in its own module and imported dynamically (see dashboard-school.tsx)
 * so jsPDF stays out of the initial bundle.
 */

type RGB = [number, number, number];

// Mirrors index.css. --primary is hsl(212 90% 46%); the signal colours are the
// --sig-* tokens, so a status here reads the same as its badge in the app.
const BRAND: RGB = [12, 110, 223];
const BRAND_DARK: RGB = [8, 74, 150];
const INK: RGB = [17, 24, 39];
const MUTED: RGB = [107, 114, 128];
const HAIRLINE: RGB = [226, 229, 235];
const TINT: RGB = [240, 246, 254];

const SIG_GREEN: RGB = [29, 158, 117];
const SIG_ORANGE: RGB = [186, 117, 23];
const SIG_RED: RGB = [163, 45, 45];
const SIG_TRACK: RGB = [221, 221, 228];

const STATUS_TEXT: Record<StudentRow["status"], RGB> = {
    active: [15, 110, 86],
    inactive: [99, 56, 6],
    at_risk: [121, 31, 31],
};
const STATUS_FILL: Record<StudentRow["status"], RGB> = {
    active: [234, 245, 238],
    inactive: [253, 243, 227],
    at_risk: [253, 240, 240],
};
const STATUS_LABEL: Record<StudentRow["status"], string> = {
    active: "Active",
    inactive: "Inactive",
    at_risk: "At Risk",
};

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;

function formatMonth(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function formatDate(iso: string | null): string {
    if (!iso) return "Never";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "Never";
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** Trims to fit a column so long chapter titles don't wrap the table open. */
function truncate(value: string, max: number): string {
    if (value.length <= max) return value;
    return `${value.slice(0, max - 1).trimEnd()}…`;
}

function drawHeader(doc: jsPDF, report: SchoolDashboardResponse) {
    doc.setFillColor(...BRAND);
    doc.rect(0, 0, PAGE_W, 34, "F");

    // A narrow darker strip under the band gives the header an edge rather
    // than letting the blue bleed straight into the page.
    doc.setFillColor(...BRAND_DARK);
    doc.rect(0, 34, PAGE_W, 1.2, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setCharSpace(1.6);
    doc.text("TECHCESS", MARGIN, 15);
    doc.setCharSpace(0);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.text("Monthly Report", PAGE_W - MARGIN, 15, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(truncate(report.school_name || "School", 46), MARGIN, 26);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(formatMonth(report.generated_at), PAGE_W - MARGIN, 26, { align: "right" });
}

function drawOverview(doc: jsPDF, report: SchoolDashboardResponse, top: number): number {
    const { overview } = report;
    const tiles: { value: string; label: string }[] = [
        { value: String(overview.total_students), label: "Students" },
        { value: String(overview.active_this_week), label: "Active this week" },
        { value: `${overview.avg_study_minutes_this_week}m`, label: "Avg study time" },
        { value: `${overview.avg_streak}d`, label: "Avg streak" },
        { value: `${overview.chapters_completed_percent}%`, label: "Completed a chapter" },
    ];

    const height = 22;
    doc.setFillColor(...TINT);
    doc.roundedRect(MARGIN, top, CONTENT_W, height, 2.5, 2.5, "F");

    const tileW = CONTENT_W / tiles.length;
    tiles.forEach((tile, i) => {
        const centre = MARGIN + tileW * i + tileW / 2;

        // Hairline separators between tiles, not around them.
        if (i > 0) {
            doc.setDrawColor(...HAIRLINE);
            doc.setLineWidth(0.3);
            doc.line(MARGIN + tileW * i, top + 4.5, MARGIN + tileW * i, top + height - 4.5);
        }

        doc.setTextColor(...BRAND);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(15);
        doc.text(tile.value, centre, top + 10.5, { align: "center" });

        doc.setTextColor(...MUTED);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.4);
        doc.text(tile.label.toUpperCase(), centre, top + 16.5, { align: "center" });
    });

    return top + height;
}

function drawSectionTitle(doc: jsPDF, title: string, top: number): number {
    doc.setTextColor(...INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(title, MARGIN, top);

    doc.setDrawColor(...BRAND);
    doc.setLineWidth(0.8);
    doc.line(MARGIN, top + 1.8, MARGIN + 14, top + 1.8);

    return top + 7;
}

function drawWeakTopics(doc: jsPDF, report: SchoolDashboardResponse, top: number): number {
    let y = drawSectionTitle(doc, "Weakest topics", top);

    const topics = report.weak_topics.slice(0, 6);
    if (!topics.length) {
        doc.setTextColor(...MUTED);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.text("No struggle data recorded this month.", MARGIN, y + 2);
        return y + 8;
    }

    // Bars are scaled against the worst topic, so the chart always uses its
    // full width regardless of the absolute counts.
    const max = Math.max(...topics.map((t) => t.struggle_count), 1);
    const labelW = 74;
    const countW = 16;
    const barW = CONTENT_W - labelW - countW;
    const rowH = 7.4;

    topics.forEach((topic, i) => {
        const rowY = y + i * rowH;

        doc.setTextColor(...INK);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text(truncate(topic.chapter_title || "—", 42), MARGIN, rowY + 3.4);

        doc.setFillColor(...SIG_TRACK);
        doc.roundedRect(MARGIN + labelW, rowY + 0.8, barW, 3.4, 1.7, 1.7, "F");

        const filled = Math.max((topic.struggle_count / max) * barW, 3.4);
        doc.setFillColor(...BRAND);
        doc.roundedRect(MARGIN + labelW, rowY + 0.8, filled, 3.4, 1.7, 1.7, "F");

        doc.setTextColor(...MUTED);
        doc.setFontSize(8.5);
        doc.text(String(topic.struggle_count), PAGE_W - MARGIN, rowY + 3.4, { align: "right" });
    });

    return y + topics.length * rowH + 2;
}

function drawNeedsAttention(doc: jsPDF, report: SchoolDashboardResponse, top: number): number {
    const flagged = report.students
        .filter((s) => s.status !== "active")
        // At Risk before Inactive: the ones to call home about come first.
        .sort((a, b) => (a.status === "at_risk" ? -1 : 1) - (b.status === "at_risk" ? -1 : 1))
        .slice(0, 8);

    const y = drawSectionTitle(doc, "Students needing attention", top);

    if (!flagged.length) {
        doc.setFillColor(...STATUS_FILL.active);
        doc.roundedRect(MARGIN, y - 2, CONTENT_W, 11, 2, 2, "F");
        doc.setTextColor(...STATUS_TEXT.active);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.text("Every student was active this month.", MARGIN + 4, y + 5);
        return y + 13;
    }

    autoTable(doc, {
        startY: y - 2,
        margin: { left: MARGIN, right: MARGIN },
        head: [["Student", "Class", "Sessions", "Last active", "Status"]],
        body: flagged.map((s) => [
            truncate(s.student_name || "—", 30),
            s.class_level || "—",
            String(s.sessions_this_week),
            formatDate(s.last_active_date),
            STATUS_LABEL[s.status],
        ]),
        theme: "plain",
        styles: { fontSize: 9, cellPadding: { top: 2.2, bottom: 2.2, left: 3, right: 3 }, textColor: INK },
        headStyles: {
            fontStyle: "bold", fontSize: 7.6, textColor: MUTED,
            fillColor: [248, 250, 252], cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
        },
        columnStyles: {
            1: { halign: "center", cellWidth: 18 },
            2: { halign: "center", cellWidth: 20 },
            3: { cellWidth: 32 },
            4: { halign: "center", cellWidth: 24 },
        },
        didParseCell: (data) => {
            if (data.section !== "body" || data.column.index !== 4) return;
            const status = flagged[data.row.index].status;
            data.cell.styles.fillColor = STATUS_FILL[status];
            data.cell.styles.textColor = STATUS_TEXT[status];
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fontSize = 8;
        },
    });

    return (doc as any).lastAutoTable.finalY + 4;
}

function drawRoster(doc: jsPDF, report: SchoolDashboardResponse, top: number) {
    const y = drawSectionTitle(doc, `Full roster (${report.students.length})`, top);

    autoTable(doc, {
        startY: y - 2,
        margin: { left: MARGIN, right: MARGIN, top: MARGIN },
        head: [["Student", "Class", "Sess.", "Current chapter", "Strengths", "Last active", "Status"]],
        body: report.students.map((s) => [
            truncate(s.student_name || "—", 26),
            s.class_level || "—",
            String(s.sessions_this_week),
            truncate(s.current_chapter || "—", 28),
            truncate(s.top_strengths.join(", ") || "—", 30),
            formatDate(s.last_active_date),
            STATUS_LABEL[s.status],
        ]),
        theme: "plain",
        styles: {
            fontSize: 8, cellPadding: { top: 1.9, bottom: 1.9, left: 2.5, right: 2.5 },
            textColor: INK, lineColor: HAIRLINE, lineWidth: { bottom: 0.2 } as any,
        },
        headStyles: {
            fontStyle: "bold", fontSize: 7.2, textColor: [255, 255, 255], fillColor: BRAND,
            cellPadding: { top: 2.4, bottom: 2.4, left: 2.5, right: 2.5 },
        },
        // Banding does the work of gridlines without boxing every cell in.
        alternateRowStyles: { fillColor: [250, 251, 253] },
        columnStyles: {
            1: { halign: "center", cellWidth: 14 },
            2: { halign: "center", cellWidth: 12 },
            5: { cellWidth: 26 },
            6: { halign: "center", cellWidth: 20 },
        },
        didParseCell: (data) => {
            if (data.section !== "body" || data.column.index !== 6) return;
            const status = report.students[data.row.index].status;
            data.cell.styles.textColor = STATUS_TEXT[status];
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fontSize = 7.4;
        },
        // Page 2 onward carries a slim title instead of the full blue band.
        didDrawPage: (data) => {
            if (data.pageNumber === 1) return;
            doc.setFillColor(...BRAND);
            doc.rect(0, 0, PAGE_W, 3, "F");
        },
    });
}

function drawFooters(doc: jsPDF, report: SchoolDashboardResponse) {
    const pages = doc.getNumberOfPages();
    const generated = new Date(report.generated_at);
    const stamp = Number.isNaN(generated.getTime())
        ? ""
        : generated.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

    for (let page = 1; page <= pages; page += 1) {
        doc.setPage(page);
        doc.setDrawColor(...HAIRLINE);
        doc.setLineWidth(0.3);
        doc.line(MARGIN, PAGE_H - 13, PAGE_W - MARGIN, PAGE_H - 13);

        doc.setTextColor(...MUTED);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.6);
        doc.text(
            `${report.school_name || "School"}${stamp ? ` · Generated ${stamp}` : ""}`,
            MARGIN,
            PAGE_H - 8.5
        );
        doc.text(`Page ${page} of ${pages}`, PAGE_W - MARGIN, PAGE_H - 8.5, { align: "right" });
    }
}

export function buildSchoolReportPdf(report: SchoolDashboardResponse): jsPDF {
    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    doc.setProperties({
        title: `${report.school_name || "School"} — Techcess monthly report`,
        creator: "Techcess",
    });

    drawHeader(doc, report);
    let y = drawOverview(doc, report, 44);
    y = drawNeedsAttention(doc, report, y + 12);
    y = drawWeakTopics(doc, report, y + 6);
    drawRoster(doc, report, y + 6);
    drawFooters(doc, report);

    return doc;
}

export function schoolReportFilename(report: SchoolDashboardResponse): string {
    const slug = (report.school_name || "school").replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "");
    return `${slug || "school"}-report-${report.generated_at.slice(0, 10)}.pdf`;
}
