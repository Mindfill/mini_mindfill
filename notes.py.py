import io
import logging

import asyncio
import re
import json
from datetime import datetime, timezone
import pdfplumber
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form
from pydantic import BaseModel
from supabase import AsyncClient
from openai import OpenAI

from app.auth.verify import get_current_user_id
from app.schemas.chat import User, Course
from app.core.rate_limit import limiter
from app.core.deps import get_supabase
from app.core.sanitize import sanitize_text
from app.utils import log_event

router = APIRouter()
client = OpenAI()
logger = logging.getLogger(__name__)

MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB

def format_lesson_plan(plan: dict) -> str:
    section_text = "\n\n".join(
        f"**{s['id']}.{s['title']}**\n{s['summary']}" for s in plan["sections"]
    )
    key_terms_text = "\n\n".join(
        f"**{kt['term']}**\n{kt['definition']}" for kt in plan["key_terms"]
    )
    return (
        f"{plan['introduction']}\n\n"
        f"**Sections:**\n\n{section_text}\n\n"
    )

@router.post("/notes/upload")
@limiter.limit("5/minute")
async def upload_note(
    request: Request,
    file: UploadFile = File(...),
    title: str = Form(...),
    course_id: str = Form(None),
    user_id: str = Depends(get_current_user_id),
    supabase: AsyncClient = Depends(get_supabase)
):
    # ── Validate file ─────────────────────────────────────────────────────
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    file_bytes = await file.read()

    if not file_bytes.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="File is not a valid PDF")

    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File exceeds 20MB limit")

    # ── Upload to Supabase Storage ────────────────────────────────────────
    safe_filename = re.sub(r"[^\w\-.]", "_", file.filename)
    storage_path = f"{user_id}/{safe_filename}"

    logger.info("About to insert note metadata")
    logger.info("Note inserted, about to insert pages")
    try:
        await supabase.storage.from_("notes-pdfs").upload(
            path=storage_path,
            file=file_bytes,
            file_options={"content-type": "application/pdf"}
        )
    except Exception as e:
        logger.exception("Failed to upload PDF to storage", extra={"user_id": user_id})
        raise HTTPException(status_code=500, detail=f"Storage upload failed: {e}")

    file_url = await supabase.storage.from_("notes-pdfs").get_public_url(storage_path)

    # ── Extract text with pdfplumber ──────────────────────────────────────
    try:
        pages = []
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            if len(pdf.pages) > 80:
                await supabase.storage.from_("notes-pdfs").remove([storage_path])
                raise HTTPException(status_code=400, detail="PDF exceeds 80 page limit.")

            for i, page in enumerate(pdf.pages):
                text = page.extract_text()
                if text and text.strip():
                    pages.append({"page_number": i + 1, "content": text.strip()})

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to extract text from PDF", extra={"user_id": user_id})
        raise HTTPException(status_code=500, detail=f"PDF text extraction failed: {e}")

    if not pages:
        await supabase.storage.from_("notes-pdfs").remove([storage_path])  # one delete covers everything
        raise HTTPException(status_code=422, detail="No extractable text found in PDF. It may be a scanned image.")

    # ── Insert into notes table ───────────────────────────────────────────
    clean_title = sanitize_text(title)

    try:
        note_res = await supabase.table("notes").insert({
            "user_id": user_id,
            "title": clean_title,
            "file_url": file_url,
            "file_name": file.filename,
            "file_size_bytes": len(file_bytes),
            "course_id": course_id
        }).execute()
    except Exception as e:
        logger.exception("Failed to insert note metadata", extra={"user_id": user_id})
        raise HTTPException(status_code=500, detail=f"Failed to save note: {e}")

    note_id = note_res.data[0]["id"]

    # ── Insert into note_pages table ──────────────────────────────────────
    try:
        await supabase.table("note_pages").insert([
            {"note_id": note_id, "page_number": p["page_number"], "content": p["content"]}
            for p in pages
        ]).execute()
    except Exception as e:
        logger.exception("Failed to insert note pages", extra={"note_id": note_id})
        raise HTTPException(status_code=500, detail=f"Failed to save note pages: {e}")

    return {
        "note_id": note_id,
        "title": title,
        "file_name": file.filename,
        "pages_extracted": len(pages)
    }

@router.get("/notes/{note_id}/onboard")
@limiter.limit("10/minute")
async def user_onboard(
    request: Request,
    note_id: str,
    user_id: str = Depends(get_current_user_id),
    supabase: AsyncClient = Depends(get_supabase)
):

    # ── Verify note ownership ─────────────────────────────────────────────
    try:
        note_res = await (
            supabase.table("notes")
                .select("id")
                .eq("id", note_id)
                .eq("user_id", user_id)
                .maybe_single()
                .execute()
        )
    except Exception as e:
        logger.exception("Failed to verify note ownership", extra={"note_id": note_id})
        raise HTTPException(status_code=500, detail=f"Failed to verify note: {e}")

    if not note_res or not note_res.data:
        raise HTTPException(status_code=404, detail="Note not found")

    # ── Check for existing lesson plan ────────────────────────────────────
    try:
        plan_res = await (
            supabase.table("note_lesson_plans")
            .select("content")
            .eq("note_id", note_id)
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
    except Exception as e:
        logger.exception("Failed to fetch lesson plan", extra={"note_id": note_id})
        raise HTTPException(status_code=500, detail=f"Failed to fetch lesson plan: {e}")

    if plan_res and plan_res.data:
        # Guard against a corrupt/truncated cached plan: if it won't parse,
        # drop it and fall through to regeneration instead of 500-ing.
        try:
            original_plan = json.loads(plan_res.data["content"])
            return {"onboarding_message": format_lesson_plan(original_plan)}
        except (json.JSONDecodeError, KeyError):
            logger.warning("Stored lesson plan is corrupt; regenerating", extra={"note_id": note_id})
            await (
                supabase.table("note_lesson_plans")
                .delete()
                .eq("note_id", note_id)
                .eq("user_id", user_id)
                .execute()
            )
            # fall through to regeneration below

    # ── No plan exists — fetch note pages ─────────────────────────────────
    try:
        pages_res = await (
            supabase.table("note_pages")
            .select("page_number, content")
            .eq("note_id", note_id)
            .order("page_number")
            .execute()
        )
    except Exception as e:
        logger.exception("Failed to fetch note pages", extra={"note_id": note_id})
        raise HTTPException(status_code=500, detail=f"Failed to fetch note pages: {e}")

    if not pages_res.data:
        raise HTTPException(status_code=404, detail="No content found for this note")

    # ── Build input for model ─────────────────────────────────────────────
    pages_text = "\n\n".join(
        f"Page {p['page_number']}:\n{p['content']}" for p in pages_res.data
    )

    # ── Generate lesson plan ──────────────────────────────────────────────
    try:
        response = client.responses.create(
            prompt={
                "id": "pmpt_6a13778d83b48193aa085af49bd29b2c0677476075777e45",
                "version": "9"
            },
            input=pages_text,
            text={
                "format": {
                "type": "text"
                }
            },
            reasoning={},
            max_output_tokens=4000,  # was 1000 — too small, truncated the JSON mid-string
            store=True,
            include=["web_search_call.action.sources"]
            )
    except Exception as e:
        logger.exception("Failed to generate lesson plan", extra={"note_id": note_id})
        raise HTTPException(status_code=500, detail=f"Failed to generate lesson plan: {e}")

    generated_plan = response.output_text

    # ── Validate before storing (never persist malformed JSON) ────────────
    try:
        plan = json.loads(generated_plan)
    except json.JSONDecodeError:
        logger.error("Model returned invalid JSON for lesson plan", extra={"note_id": note_id})
        raise HTTPException(status_code=502, detail="Lesson plan generation returned malformed data. Please try again.")

    # ── Store lesson plan (only once we know it's valid JSON) ──────────────
    try:
        await (
            supabase.table("note_lesson_plans")
            .insert({"note_id": note_id, "user_id": user_id, "content": generated_plan})
            .execute()
        )
    except Exception as e:
        logger.exception("Failed to store lesson plan", extra={"note_id": note_id})
        raise HTTPException(status_code=500, detail=f"Failed to store lesson plan: {e}")

    page_map = plan.get("page_map", {})
    if page_map:
        await asyncio.gather(*[
            supabase.table("note_pages")
                .update({"section_ids": section_ids})
                .eq("note_id", note_id)
                .eq("page_number", int(page_num))
                .execute()
            for page_num, section_ids in page_map.items()
        ])


    ui_response = format_lesson_plan(plan)

    return {
    "onboarding_message": ui_response,
    "lesson_plan": plan
    }

@router.post("/notes/{note_id}/chat")
@limiter.limit("20/minute")
async def notes_chat(
    request: Request,
    input: User,
    note_id: str,
    user_id: str = Depends(get_current_user_id),
    supabase: AsyncClient = Depends(get_supabase)
):

    # ── Verify note ownership ─────────────────────────────────────────────
    try:
        note_res = await (
            supabase.table("notes")
                .select("id")
                .eq("id", note_id)
                .eq("user_id", user_id)
                .maybe_single()
                .execute()
        )
    except Exception as e:
        logger.exception("Failed to verify note ownership", extra={"note_id": note_id})
        raise HTTPException(status_code=500, detail=f"Failed to verify note: {e}")

    if not note_res or not note_res.data:
        raise HTTPException(status_code=404, detail="Note not found")

    # ── Fetch history and lesson plan concurrently ────────────────────────
    try:
        history_res, plan_res, progress_res = await asyncio.gather(
        supabase.table("note_conversations")
            .select("role, content")
            .eq("user_id", user_id)
            .eq("note_id", note_id)
            .order("created_at")
            .execute(),

        supabase.table("note_lesson_plans")
            .select("content")
            .eq("user_id", user_id)
            .eq("note_id", note_id)
            .maybe_single()
            .execute(),

        supabase.table("note_progress")
            .select("id, current_layer, exchange_count, status")
            .eq("user_id", user_id)
            .eq("note_id", note_id)
            .maybe_single()
            .execute()
        )
    except Exception as e:
        logger.exception("Failed to fetch chat data", extra={"note_id": note_id})
        raise HTTPException(status_code=500, detail=f"Failed to fetch chat data: {e}")

    if not plan_res or not plan_res.data:
        raise HTTPException(status_code=400, detail="No lesson plan found. Please onboard first.")

   # ── Get or create session ─────────────────────────────────────────────
    try:
        session_res = await (
            supabase.table("note_sessions")
                .select("id, selected_sections")
                .eq("user_id", user_id)
                .eq("note_id", note_id)
                .maybe_single()
                .execute()
        )
    except Exception as e:
        logger.exception("Failed to fetch session", extra={"note_id": note_id})
        raise HTTPException(status_code=500, detail=f"Failed to fetch session: {e}")

    if session_res and session_res.data:
        session_id = session_res.data["id"]
        selected_sections = session_res.data["selected_sections"]

        # First message — store the selection
        if not selected_sections and input.selected_sections:
            await supabase.table("note_sessions").update(
                {"selected_sections": input.selected_sections}
            ).eq("id", session_id).execute()
            selected_sections = input.selected_sections
    else:
        try:
            new_session = await (
                supabase.table("note_sessions")
                    .insert({"user_id": user_id, "note_id": note_id})
                    .execute()
            )
            session_id = new_session.data[0]["id"]
            selected_sections = input.selected_sections
            if selected_sections:
                await supabase.table("note_sessions").update(
                    {"selected_sections": selected_sections}
                ).eq("id", session_id).execute()
        except Exception as e:
            logger.exception("Failed to create session", extra={"note_id": note_id})
            raise HTTPException(status_code=500, detail=f"Failed to create session: {e}")

        # ── Get or create progress ────────────────────────────────────────────
    current_layer = "LAYER_1"
    exchange_count = 0

    if not progress_res or not progress_res.data:
        await supabase.table("note_progress").insert({
            "user_id": user_id,
            "note_id": note_id,
            "session_id": session_id,
            "current_layer": "LAYER_1",
            "exchange_count": 0,
            "status": "in_progress"
        }).execute()
        await log_event(supabase, user_id, session_id, note_id, "lesson_started", {
            "layer": "LAYER_1"
        })
    else:
        current_layer = progress_res.data["current_layer"]
        exchange_count = progress_res.data["exchange_count"]

    # ── Build model input ─────────────────────────────────────────────────
    clean_content = sanitize_text(input.content)
    messages = list(history_res.data or [])
    messages.insert(0, {"role": "developer", "content": plan_res.data["content"]})

    if selected_sections:
        sections_context = f"The student has selected sections: {selected_sections}. Focus primarily on these sections."
        messages.insert(1, {"role": "developer", "content": sections_context})

    messages.append({"role": input.role, "content": clean_content})

    # ── Call model ────────────────────────────────────────────────────────
    try:
        response = client.responses.create(
        prompt={
            "id": "pmpt_6a138ea1b574819497a8a750648902e9090dad6aa4f1ee56",
            "version": "4"
        },
        input=messages,
        prompt_cache_key=f"mindfill:notes:{note_id}",
        text={
            "format": {
            "type": "text"
            }
        },
        reasoning={},
        max_output_tokens=1500,  # was 500 — too tight, truncated the JSON on longer answers
        store=True,
        include=["web_search_call.action.sources"]
        )
    except Exception as e:
        logger.exception("Failed to call model", extra={"note_id": note_id})
        raise HTTPException(status_code=500, detail=f"Model call failed: {e}")

    # ── Parse model response ──────────────────────────────────────────────
    try:
        response_dict = json.loads(response.output_text)
    except json.JSONDecodeError:
        logger.error("Model returned invalid JSON for chat response", extra={"note_id": note_id})
        raise HTTPException(status_code=502, detail="Chat response was malformed. Please try again.")

    if "content" not in response_dict:
        logger.error("Chat response missing 'content' field", extra={"note_id": note_id})
        raise HTTPException(status_code=502, detail="Chat response was incomplete. Please try again.")

    phase_two = response_dict.get("phase_two", False)
    completed = response_dict.get("completed", False)
    new_layer = response_dict.get("layer", current_layer)

    # ── Build progress update ─────────────────────────────────────────────
    update_data = {
        "exchange_count": exchange_count + 1,
        "current_layer": new_layer,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }

    if completed:
        update_data["status"] = "completed"
        update_data["completed_at"] = datetime.now(timezone.utc).isoformat()
        await log_event(supabase, user_id, session_id, note_id, "lesson_completed", {
            "layer": new_layer,
            "exchange_count": exchange_count + 1
        })

    # ── Save conversation ─────────────────────────────────────────────────
    # ── Write conversations + progress concurrently ───────────────────────

    try:
        await asyncio.gather(
            supabase.table("note_conversations").insert([
                {
                    "user_id": user_id,
                    "note_id": note_id,
                    "session_id": session_id,
                    "role": input.role,
                    "content": clean_content
                },
                {
                    "user_id": user_id,
                    "note_id": note_id,
                    "session_id": session_id,
                    "role": "assistant",
                    "content": response_dict["content"]
                }
            ]).execute(),

            supabase.table("note_progress")
                .update(update_data)
                .eq("user_id", user_id)
                .eq("note_id", note_id)
                .execute()
        )
    except Exception as e:
        logger.exception("Failed to write conversation/progress", extra={"note_id": note_id})
        raise HTTPException(status_code=500, detail=f"Failed to save response: {e}")

    return response_dict

@router.post("/courses")
@limiter.limit("10/minute")
async def create_course(request: Request, input: Course, supabase: AsyncClient = Depends(get_supabase), user_id: str = Depends(get_current_user_id)):
    try:
        response = await (
            supabase.table("user_courses")
            .insert({"user_id": user_id, "name": input.name, "course_code": input.course_code, "description": input.description})
            .execute()
        )
    except Exception as e:
        logging.exception("Failed to create course")
        raise HTTPException(status_code=502, detail=f"Failed to create course: {e}")

    return response.data[0]

@router.get("/courses")
async def get_courses(supabase: AsyncClient = Depends(get_supabase), user_id: str = Depends(get_current_user_id)):
    try:
        response = await (
            supabase.table("user_courses")
            .select("id, name, course_code, description")
            .eq("user_id", user_id)
            .execute()
        )
    except Exception as e:
        logging.exception("Failed to get courses")
        raise HTTPException(status_code=502, detail=f"Failed to get course: {e}")

    return response.data

@router.get("/courses/{course_id}/notes")
async def get_notes(course_id: str, supabase: AsyncClient = Depends(get_supabase), user_id = Depends(get_current_user_id)):
    try:
        notes_list = await (supabase.table("notes")
        .select("id, title, file_url, created_at")
        .eq("user_id", user_id)
        .eq("course_id", course_id)
        .execute())
    except Exception as e:
        raise HTTPException(status_code=502, detail= f"Failed to get notes: {e}")

    return notes_list.data

@router.get("/notes/{note_id}/history")
async def note_chat_history(note_id: str, user_id: str = Depends(get_current_user_id), supabase: AsyncClient = Depends(get_supabase)):
    try:
        response = await (
            supabase.table("note_conversations")
            .select("role, content")
            .eq("user_id", user_id)
            .eq("note_id", note_id)
            .order("created_at")
            .execute()
        )
    except Exception as e:
        logging.exception("Failed to get history")
        raise HTTPException(status_code=502, detail=f"Failed to get history: {e}")

    return response.data


class QuizRequest(BaseModel):
    selected_sections: list[str]

@router.post("/notes/{note_id}/quiz")
@limiter.limit("10/minute")
async def generate_quiz(
    request: Request,
    input: QuizRequest,
    note_id: str,
    user_id: str = Depends(get_current_user_id),
    supabase: AsyncClient = Depends(get_supabase)
):
    if not input.selected_sections:
        raise HTTPException(status_code=400, detail="No sections selected")

    # ── Verify note ownership ─────────────────────────────────────────────
    try:
        note_res = await (
            supabase.table("notes")
            .select("id")
            .eq("id", note_id)
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
    except Exception as e:
        logger.exception("Failed to verify note ownership", extra={"note_id": note_id})
        raise HTTPException(status_code=500, detail=f"Failed to verify note: {e}")

    if not note_res or not note_res.data:
        raise HTTPException(status_code=404, detail="Note not found")

    # ── Fetch lesson plan ─────────────────────────────────────────────────
    try:
        plan_res = await (
            supabase.table("note_lesson_plans")
            .select("content")
            .eq("note_id", note_id)
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
    except Exception as e:
        logger.exception("Failed to fetch lesson plan", extra={"note_id": note_id})
        raise HTTPException(status_code=500, detail=f"Failed to fetch lesson plan: {e}")

    if not plan_res or not plan_res.data:
        raise HTTPException(status_code=400, detail="No lesson plan found. Please onboard first.")

    # ── Fetch relevant pages ──────────────────────────────────────────────
    try:
        pages_res = await (
            supabase.table("note_pages")
            .select("page_number, content")
            .eq("note_id", note_id)
            .contains("section_ids", input.selected_sections)
            .order("page_number")
            .execute()
        )
    except Exception as e:
        logger.exception("Failed to fetch note pages", extra={"note_id": note_id})
        raise HTTPException(status_code=500, detail=f"Failed to fetch note pages: {e}")

    if not pages_res.data:
        raise HTTPException(status_code=404, detail="No content found for selected sections")

    # ── Build prompt input ────────────────────────────────────────────────
    try:
        plan = json.loads(plan_res.data["content"])
    except json.JSONDecodeError:
        logger.error("Stored lesson plan is corrupt", extra={"note_id": note_id})
        raise HTTPException(status_code=502, detail="Lesson plan is corrupt. Please re-open the note to regenerate it.")

    selected_section_titles = [
        s["title"] for s in plan.get("sections", [])
        if s["id"] in input.selected_sections
    ]

    pages_text = "\n\n".join(
        f"Page {p['page_number']}:\n{p['content']}" for p in pages_res.data
    )

    prompt_input = (
        f"Selected sections: {', '.join(selected_section_titles)}\n\n"
        f"Note content:\n{pages_text}"
    )

    # ── Generate quiz ─────────────────────────────────────────────────────
    try:
        response = client.responses.create(
            prompt={
                "id": "pmpt_6a1ddebc42288196aa9152344fa11c0404840cd408b9ea02",
                "version": "1"
            },
            input=prompt_input,
            text={
                "format": {
                "type": "text"
                }
            },
            reasoning={},
            max_output_tokens=4000,  # was 2048 — can truncate multi-question quizzes
            store=True,
            include=["web_search_call.action.sources"]
            )
    except Exception as e:
        logger.exception("Failed to generate quiz", extra={"note_id": note_id})
        raise HTTPException(status_code=500, detail=f"Failed to generate quiz: {e}")

    # ── Parse quiz (never trust the model returned well-formed JSON) ───────
    try:
        questions = json.loads(response.output_text)
    except json.JSONDecodeError:
        logger.error("Model returned invalid JSON for quiz", extra={"note_id": note_id})
        raise HTTPException(status_code=502, detail="Quiz generation returned malformed data. Please try again.")

    # ── Store quiz ────────────────────────────────────────────────────────
    try:
        quiz_res = await (
            supabase.table("note_quizzes")
            .insert({
                "user_id": user_id,
                "note_id": note_id,
                "selected_sections": input.selected_sections,
                "questions": json.dumps(questions)
            })
            .execute()
        )
    except Exception as e:
        logger.exception("Failed to store quiz", extra={"note_id": note_id})
        raise HTTPException(status_code=500, detail=f"Failed to save quiz: {e}")

    return {
        "quiz_id": quiz_res.data[0]["id"],
        "questions": questions
    }
