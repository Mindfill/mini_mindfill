import { supabase } from "./supabase";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000";

const getHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
    };
};

export async function fetchQuestions(lessonId: string, type: string, layer: string, difficulty: string) {
    const res = await fetch(`${BACKEND_URL}/quiz/${lessonId}/questions?type=${type}&layer=${layer}&difficulty=${difficulty}`, {
        headers: await getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch questions");
    return res.json();
}

export async function fetchTimedBatch(lessonId: string, layer: string, difficulty: string) {
    const res = await fetch(`${BACKEND_URL}/quiz/${lessonId}/timed?layer=${layer}&difficulty=${difficulty}`, {
        headers: await getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch timed batch");
    return res.json();
}

export async function submitAttempt(questionId: string, lessonId: string, correct: boolean, studentAnswer: string) {
    const res = await fetch(`${BACKEND_URL}/quiz/attempt`, {
        method: "POST",
        headers: await getHeaders(),
        body: JSON.stringify({ question_id: questionId, lesson_id: lessonId, correct, student_answer: studentAnswer }),
    });
    if (!res.ok) throw new Error("Failed to submit attempt");
    return res.json();
}

export async function submitBatchAttempts(attempts: any[]) {
    const res = await fetch(`${BACKEND_URL}/quiz/attempt/batch`, {
        method: "POST",
        headers: await getHeaders(),
        body: JSON.stringify({ attempts }),
    });
    if (!res.ok) throw new Error("Failed to submit batch attempts");
    return res.json();
}

export async function fetchStats(lessonId: string) {
    const res = await fetch(`${BACKEND_URL}/quiz/${lessonId}/stats`, {
        headers: await getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch stats");
    return res.json();
}

export async function fetchExplanation(lessonId: string, question: any, correctAnswer: string, studentAnswer: string, history: any[]) {
    const res = await fetch(`${BACKEND_URL}/quiz/explain`, {
        method: "POST",
        headers: await getHeaders(),
        body: JSON.stringify({
            lesson_id: lessonId,
            question,
            correct_answer: correctAnswer,
            student_answer: studentAnswer,
            history,
        }),
    });
    if (!res.ok) throw new Error("Failed to fetch explanation");
    return res.json();
}
