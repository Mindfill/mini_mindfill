import asyncio
import json
import logging
import random
import os
from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from openai import AsyncOpenAI
from pydantic import BaseModel, Field
from supabase import AsyncClient

from app.auth.verify import get_current_user_id
from app.core.deps import get_supabase
from app.utils.rewards import update_streak
from app.manim_utils import log_event
from app.utils.usage import *


router = APIRouter()
client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
logger = logging.getLogger(__name__)

VALID_TYPES = {"mcq", "flashcard"}
VALID_LAYERS = {"L1", "L2"}
VALID_DIFFICULTIES = {"easy", "medium", "hard"}


class AttemptRequest(BaseModel):
    question_id: str
    lesson_id: str
    correct: bool
    student_answer: str
    session_id: str | None = None


class BatchAttemptRequest(BaseModel):
    attempts: list[AttemptRequest] = Field(default_factory=list)
    session_id: str | None = None


class QuizExplainRequest(BaseModel):
    lesson_id: str
    question: str
    correct_answer: str
    student_answer: str
    history: list[dict[str, Any]] = Field(default_factory=list)


def _normalize_type(question_type: str) -> str:
    normalized = question_type.strip().lower()
    if normalized not in VALID_TYPES:
        raise HTTPException(status_code=400, detail="Invalid type. Expected one of: mcq, flashcard")
    return normalized


def _normalize_layer(layer: str) -> str:
    normalized = layer.strip().upper()
    if normalized not in VALID_LAYERS:
        raise HTTPException(status_code=400, detail="Invalid layer. Expected one of: L1, L2")
    return normalized


def _normalize_difficulty(difficulty: str) -> str:
    normalized = difficulty.strip().lower()
    if normalized not in VALID_DIFFICULTIES:
        raise HTTPException(status_code=400, detail="Invalid difficulty. Expected one of: easy, medium, hard")
    return normalized


def _normalize_learning_objectives(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            return value
    if isinstance(value, list):
        return "; ".join(str(item) for item in value)
    if isinstance(value, dict):
        return json.dumps(value, ensure_ascii=True)
    return str(value)


async def _safe_log_event(supabase: AsyncClient, *args, **kwargs) -> None:
    """Analytics logging must never fail the request that triggered it."""
    try:
        await log_event(supabase, *args, **kwargs)
    except Exception:
        logger.exception("Failed to write analytics event")


async def _get_lesson_by_slug(supabase: AsyncClient, lesson_slug: str) -> dict[str, Any]:
    try:
        lesson_res = await (
            supabase.table("lessons")
            .select("id, slug, title")
            .eq("slug", lesson_slug)
            .maybe_single()
            .execute()
        )
    except Exception as exc:
        logger.exception("Failed to fetch lesson", extra={"lesson_slug": lesson_slug})
        raise HTTPException(status_code=500, detail=f"Failed to fetch lesson: {exc}")

    if not lesson_res or not lesson_res.data:
        raise HTTPException(status_code=404, detail="Lesson not found")

    return lesson_res.data


async def _get_lesson_by_id(supabase: AsyncClient, lesson_id: str) -> dict[str, Any]:
    try:
        lesson_res = await (
            supabase.table("lessons")
            .select("id, slug, title")
            .eq("id", lesson_id)
            .maybe_single()
            .execute()
        )
    except Exception as exc:
        logger.exception("Failed to fetch lesson", extra={"lesson_id": lesson_id})
        raise HTTPException(status_code=500, detail=f"Failed to fetch lesson: {exc}")

    if not lesson_res or not lesson_res.data:
        raise HTTPException(status_code=404, detail="Lesson not found")

    return lesson_res.data


def _is_uuid(value: str) -> bool:
    try:
        UUID(value)
        return True
    except ValueError:
        return False


async def _resolve_lesson_ref(supabase: AsyncClient, lesson_ref: str) -> dict[str, Any]:
    if _is_uuid(lesson_ref):
        return await _get_lesson_by_id(supabase, lesson_ref)
    return await _get_lesson_by_slug(supabase, lesson_ref)


@router.get("/{lesson_slug}/questions")
async def get_lesson_questions(
    lesson_slug: str,
    type: str = Query(...),
    layer: str = Query(...),
    difficulty: str = Query(...),
    user_id: str = Depends(get_current_user_id),
    supabase: AsyncClient = Depends(get_supabase),
):
    session_id = str(uuid4())
    question_type = _normalize_type(type)
    normalized_layer = _normalize_layer(layer)
    normalized_difficulty = _normalize_difficulty(difficulty)
    lesson = await _get_lesson_by_slug(supabase, lesson_slug)
    lesson_id = lesson["id"]

    try:
        questions_res = await (
            supabase.table("questions")
            .select("id, type, layer, difficulty, question, answer, options, explanation")
            .eq("lesson_id", lesson_id)
            .eq("type", question_type)
            .eq("layer", normalized_layer)
            .eq("difficulty", normalized_difficulty)
            .eq("is_active", True)
            .execute()
        )
    except Exception as exc:
        logger.exception("Failed to fetch questions", extra={"lesson_id": lesson_id, "user_id": user_id})
        raise HTTPException(status_code=500, detail=f"Failed to fetch questions: {exc}")

    questions = list(questions_res.data or [])
    event_type = "flashcard_started" if question_type == "flashcard" else "quiz_started"
    await _safe_log_event(supabase, user_id, session_id, None, event_type, {
        "session_id": session_id,
        "lesson_id": lesson_id,
        "source": "lessons",
        "type": question_type,
        "layer": normalized_layer,
        "difficulty": normalized_difficulty,
        "question_count": len(questions),
    })
    if not questions:
        return {"session_id": session_id, "questions": []}

    question_ids = [row["id"] for row in questions]

    try:
        attempts_res = await (
            supabase.table("question_attempts")
            .select("question_id")
            .eq("user_id", user_id)
            .eq("lesson_id", lesson_id)
            .eq("correct", True)
            .in_("question_id", question_ids)
            .execute()
        )
    except Exception as exc:
        logger.exception("Failed to fetch prior attempts", extra={"lesson_id": lesson_id, "user_id": user_id})
        raise HTTPException(status_code=500, detail=f"Failed to fetch prior attempts: {exc}")

    completed_ids = {row["question_id"] for row in (attempts_res.data or [])}
    remaining = [row for row in questions if row["id"] not in completed_ids]
    if remaining:
        random.shuffle(remaining)
        return {"session_id": session_id, "questions": remaining}

    random.shuffle(questions)
    return {"session_id": session_id, "questions": questions}


@router.get("/{lesson_slug}/timed")
async def get_timed_quiz_batch(
    lesson_slug: str,
    layer: str = Query(...),
    difficulty: str = Query(...),
    user_id: str = Depends(get_current_user_id),
    supabase: AsyncClient = Depends(get_supabase),
):
    session_id = str(uuid4())
    normalized_layer = _normalize_layer(layer)
    normalized_difficulty = _normalize_difficulty(difficulty)
    lesson = await _get_lesson_by_slug(supabase, lesson_slug)
    lesson_id = lesson["id"]

    try:
        questions_res = await (
            supabase.table("questions")
            .select("id, type, layer, difficulty, question, answer, options, explanation")
            .eq("lesson_id", lesson_id)
            .eq("layer", normalized_layer)
            .eq("difficulty", normalized_difficulty)
            .eq("is_active", True)
            .in_("type", ["mcq", "flashcard"])
            .execute()
        )
    except Exception as exc:
        logger.exception("Failed to fetch timed quiz questions", extra={"lesson_id": lesson_id, "user_id": user_id})
        raise HTTPException(status_code=500, detail=f"Failed to fetch timed quiz questions: {exc}")

    questions = list(questions_res.data or [])
    random.shuffle(questions)
    selected_questions = questions[:15]

    await _safe_log_event(supabase, user_id, session_id, None, "quiz_started", {
        "session_id": session_id,
        "lesson_id": lesson_id,
        "source": "lessons",
        "type": "timed",
        "layer": normalized_layer,
        "difficulty": normalized_difficulty,
        "question_count": len(selected_questions),
    })

    return {"session_id": session_id, "questions": selected_questions}


@router.post("/attempt")
async def submit_attempt(
    request: Request,
    payload: AttemptRequest,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
    supabase: AsyncClient = Depends(get_supabase),
):
    # Resolve the lesson safely so a bad ref returns a clean error (with CORS)
    # rather than an unhandled 500.
    try:
        lesson = await _resolve_lesson_ref(supabase, payload.lesson_id)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to resolve lesson for attempt", extra={"lesson_ref": payload.lesson_id, "user_id": user_id})
        raise HTTPException(status_code=500, detail=f"Failed to resolve lesson: {exc}")
    lesson_id = lesson["id"]

    try:
        question_res = await (
            supabase.table("questions")
            .select("id, answer, explanation")
            .eq("id", payload.question_id)
            .eq("lesson_id", lesson_id)
            .maybe_single()
            .execute()
        )
    except Exception as exc:
        logger.exception("Failed to fetch question for attempt", extra={"question_id": payload.question_id, "user_id": user_id})
        raise HTTPException(status_code=500, detail=f"Failed to fetch question: {exc}")

    if not question_res or not question_res.data:
        raise HTTPException(status_code=404, detail="Question not found")

    attempt_row = {
        "user_id": user_id,
        "question_id": payload.question_id,
        "lesson_id": lesson_id,
        "correct": payload.correct,
        "student_answer": payload.student_answer,
        "attempted_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        await supabase.table("question_attempts").insert(attempt_row).execute()
    except Exception as exc:
        logger.exception("Failed to save attempt", extra={"question_id": payload.question_id, "user_id": user_id})
        raise HTTPException(status_code=500, detail=f"Failed to save attempt: {exc}")

    # Streak update runs after the response — use the app-level (long-lived) client.
    background_tasks.add_task(update_streak, request.app.state.supabase, user_id)

    session_id = payload.session_id or str(uuid4())
    await _safe_log_event(supabase, user_id, session_id, None, "quiz_attempted", {
        "session_id": session_id,
        "question_id": payload.question_id,
        "lesson_id": lesson_id,
        "correct": payload.correct,
    })

    return {
        "correct": payload.correct,
        "correct_answer": question_res.data["answer"],
        "explanation": question_res.data["explanation"],
    }


@router.post("/attempt/batch")
async def submit_batch_attempts(
    request: Request,
    payload: BatchAttemptRequest,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
    supabase: AsyncClient = Depends(get_supabase),
):
    session_id = payload.session_id or str(uuid4())
    timestamp = datetime.now(timezone.utc).isoformat()
    rows = []

    try:
        for attempt in payload.attempts:
            lesson = await _resolve_lesson_ref(supabase, attempt.lesson_id)
            rows.append(
                {
                    "user_id": user_id,
                    "question_id": attempt.question_id,
                    "lesson_id": lesson["id"],
                    "correct": attempt.correct,
                    "attempted_at": timestamp,
                }
            )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to resolve lessons for batch attempts", extra={"user_id": user_id})
        raise HTTPException(status_code=500, detail=f"Failed to resolve lessons: {exc}")

    if rows:
        try:
            await supabase.table("question_attempts").insert(rows).execute()
        except Exception as exc:
            logger.exception("Failed to save batch attempts", extra={"user_id": user_id, "count": len(rows)})
            raise HTTPException(status_code=500, detail=f"Failed to save batch attempts: {exc}")

    saved = len(rows)
    correct = sum(1 for attempt in payload.attempts if attempt.correct)
    accuracy = round(correct / saved, 2) if saved else 0

    background_tasks.add_task(update_streak, request.app.state.supabase, user_id)
    await _safe_log_event(supabase, user_id, session_id, None, "quiz_completed", {
        "session_id": session_id,
        "saved": saved,
        "correct": correct,
        "accuracy": accuracy,
    })

    return {
        "saved": saved,
        "correct": correct,
        "accuracy": accuracy,
    }


@router.get("/{lesson_ref}/stats")
async def get_quiz_stats(
    lesson_ref: str,
    user_id: str = Depends(get_current_user_id),
    supabase: AsyncClient = Depends(get_supabase),
):
    lesson = await _resolve_lesson_ref(supabase, lesson_ref)
    lesson_id = lesson["id"]

    try:
        attempts_res = await (
            supabase.table("question_attempts")
            .select("question_id, correct")
            .eq("user_id", user_id)
            .eq("lesson_id", lesson_id)
            .execute()
        )
        questions_res = await (
            supabase.table("questions")
            .select("id")
            .eq("lesson_id", lesson_id)
            .eq("is_active", True)
            .execute()
        )
    except Exception as exc:
        logger.exception("Failed to fetch quiz stats", extra={"lesson_id": lesson_id, "user_id": user_id})
        raise HTTPException(status_code=500, detail=f"Failed to fetch quiz stats: {exc}")

    attempts = list(attempts_res.data or [])
    total_questions = len(questions_res.data or [])
    completed_ids = {row["question_id"] for row in attempts}
    correct_ids = {row["question_id"] for row in attempts if row.get("correct") is True}
    completed = len(completed_ids)
    correct = len(correct_ids)
    accuracy = round(correct / completed, 2) if completed else 0.0
    remaining = max(total_questions - correct, 0)

    return {
        "total_questions": total_questions,
        "completed": completed,
        "correct": correct,
        "accuracy": accuracy,
        "remaining": remaining,
    }


@router.post("/explain")
async def explain_quiz_answer(
    request: Request,
    payload: QuizExplainRequest,
    user_id: str = Depends(get_current_user_id),
    supabase: AsyncClient = Depends(get_supabase),
):
    lesson = await _resolve_lesson_ref(supabase, payload.lesson_id)
    lesson_id = lesson["id"]

    try:
        blueprint_res = await (
            supabase.table("lesson_blueprints")
            .select("learning_objectives")
            .eq("lesson_id", lesson_id)
            .eq("is_active", True)
            .maybe_single()
            .execute()
        )
    except Exception as exc:
        logger.exception("Failed to fetch quiz explanation blueprint", extra={"lesson_id": lesson_id})
        raise HTTPException(status_code=500, detail=f"Failed to fetch blueprint: {exc}")

    if not blueprint_res or not blueprint_res.data:
        raise HTTPException(status_code=404, detail="Blueprint not found")

    learning_objectives = _normalize_learning_objectives(blueprint_res.data.get("learning_objectives"))
    system_message = (
        f"You are TECHESS, a calm and patient AI tutor.\n"
        f"A student is reviewing {lesson['title']} and got a quiz question wrong.\n"
        "Your job is to give clear, concise explanations that build understanding.\n"
        "Link explanations back to the core concept of the lesson where helpful.\n"
        "When explaining a wrong answer, identify the gap in reasoning, correct it simply,\n"
        "Never ask the student questions. Never lecture at length.\n"
        "Respond conversationally. Keep each response to 3-5 sentences unless the student explicitly asks for more detail."
    )
    if learning_objectives:
        system_message = f"{system_message}\nCore learning objectives: {learning_objectives}"

    messages: list[dict[str, str]] = []

    if payload.history:
        messages.extend(payload.history)
    else:
        messages.append(
            {
                "role": "user",
                "content": (
                    f"Question: {payload.question}\n"
                    f"My answer: {payload.student_answer}\n"
                    f"Correct answer: {payload.correct_answer}\n\n"
                    "Can you explain why the correct answer is right?"
                ),
            }
        )

    try:
        response = await client.responses.create(
            model="gpt-4.1-mini",
            instructions=system_message,
            input=messages,
            max_output_tokens=500,
            temperature=0.4,
        )
        usage = getattr(response, "usage", None)
        input_tokens = getattr(usage, "input_tokens", 0) or 0
        output_tokens = getattr(usage, "output_tokens", 0) or 0
        input_tokens_details = getattr(usage, "input_tokens_details", None)
        cached_tokens = getattr(input_tokens_details, "cached_tokens", 0) or 0
        usd_cost = ((input_tokens - cached_tokens) * GPT41_MINI_INPUT) + (cached_tokens * GPT41_MINI_CACHED_INPUT) + (output_tokens * GPT41_MINI_OUTPUT)
        asyncio.create_task(log_usage(supabase, user_id, "lesson_quiz_explain", "gpt-5.4-mini", input_tokens, output_tokens, usd_cost, cached_tokens=cached_tokens, lesson_id=lesson_id))
        if getattr(request.state, "subscription_status", None) == "free":
            asyncio.create_task(supabase.rpc("deduct_credits", {"p_user_id": user_id, "p_amount": usd_cost / CREDIT_USD_VALUE}).execute())
    except Exception as exc:
        logger.exception("Failed to generate quiz explanation", extra={"lesson_id": lesson_id})
        raise HTTPException(status_code=500, detail=f"Failed to generate explanation: {exc}")

    message = response.output_text or ""
    return {"message": message or ""}
