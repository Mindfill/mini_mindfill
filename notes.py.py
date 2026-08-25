import io
import base64
import logging
import httpx

import asyncio
import re
import json
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from supabase import AsyncClient
from openai import AsyncOpenAI
from anthropic import AsyncAnthropic

from app.auth.verify import get_current_user_id
from app.schemas.chat import User, Course
from app.core.rate_limit import limiter
from app.core.deps import get_supabase
from app.core.sanitize import sanitize_text
from app.utils.summarization import generate_rolling_summary
from app.manim_utils import log_event, notes_chat_generator, notes_lesson_plan, notes_quiz_generator, EXTRACTION_SYSTEM_PROMPT
from app.utils.usage import *
from app.utils.rewards import update_streak
from app.workers.manim_worker import process_visualizations

router = APIRouter()
client = AsyncOpenAI(
    timeout=httpx.Timeout(
        connect=60.0,
        read=300.0,
        write=300.0,
        pool=60.0
    )
)

logger = logging.getLogger(__name__)

MAX_FILE_SIZE = 30 * 1024 * 1024  # 30MB
MAX_PDF_PAGES = 100


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

async def extract_sections_with_luna(supabase: AsyncClient, file_bytes: bytes, user_id: str) -> list[dict]:
    pdf_base64 = base64.standard_b64encode(file_bytes).decode("utf-8")

    response = await client.responses.create(
        model="gpt-5.6-luna",
        reasoning={"effort": "none"},
        instructions=EXTRACTION_SYSTEM_PROMPT,
        max_output_tokens=16000,
        input=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_file",
                        "filename": "notes.pdf",
                        "file_data": f"data:application/pdf;base64,{pdf_base64}"
                    },
                    {
                        "type": "input_text",
                        "text": "Extract and structure all content from this PDF into sections as specified."
                    }
                ]
            }
        ]
    )

    raw = response.output_text.strip()
    raw = re.sub(r"^```json\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    usage = getattr(response, "usage", None)
    input_tokens = getattr(usage, "input_tokens", 0) or 0
    output_tokens = getattr(usage, "output_tokens", 0) or 0
    input_tokens_details = getattr(usage, "input_tokens_details", None)
    cached_tokens = getattr(input_tokens_details, "cached_tokens", 0) or 0
    cache_write_tokens = getattr(input_tokens_details, "cache_write_tokens", 0) or 0
    usd_cost = (
        ((input_tokens - cached_tokens - cache_write_tokens) * LUNA_INPUT)
        + (cached_tokens * LUNA_CACHED_INPUT)
        + (cache_write_tokens * LUNA_CACHE_WRITE)
        + (output_tokens * LUNA_OUTPUT)
    )
    # note_id doesn't exist yet — the note row is inserted after extraction succeeds.
    asyncio.create_task(log_usage(supabase, user_id, "notes_upload", "gpt-5.6-luna", input_tokens, output_tokens, usd_cost, cached_tokens=cached_tokens, cache_write_tokens=cache_write_tokens, note_id=None))

    parsed = json.loads(raw)
    return parsed["sections"]

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
    logger.info(f"notes upload hit", extra={"user_id": user_id})
    # Validate file type
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    file_bytes = await file.read()

    # Validate PDF magic bytes
    if not file_bytes.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="File is not a valid PDF")

    # Validate file size
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File exceeds 20MB limit")

    # Upload to Supabase Storage
    safe_filename = re.sub(r"[^\w\-.]", "_", file.filename)
    storage_path = f"{user_id}/{safe_filename}"

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

    # Extract sections with Luna
    try:
        sections = await extract_sections_with_luna(supabase=supabase, file_bytes=file_bytes, user_id=user_id)
    except json.JSONDecodeError as e:
        await supabase.storage.from_("notes-pdfs").remove([storage_path])
        logger.exception("Luna returned invalid JSON", extra={"user_id": user_id})
        raise HTTPException(status_code=422, detail="Failed to parse extracted content. Please try again.")
    except Exception as e:
        await supabase.storage.from_("notes-pdfs").remove([storage_path])
        logger.exception("Luna extraction failed", extra={"user_id": user_id})
        raise HTTPException(status_code=500, detail=f"Content extraction failed: {e}")

    if not sections:
        await supabase.storage.from_("notes-pdfs").remove([storage_path])
        raise HTTPException(status_code=422, detail="No content could be extracted from this PDF.")

    # Insert note metadata
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
        await supabase.storage.from_("notes-pdfs").remove([storage_path])
        logger.exception("Failed to insert note metadata", extra={"user_id": user_id})
        raise HTTPException(status_code=500, detail=f"Failed to save note: {e}")

    note_id = note_res.data[0]["id"]

    # Insert extracted sections
    try:
        await supabase.table("note_sections").insert([
            {
                "note_id": note_id,
                "section_index": s["section_index"],
                "title": s["title"],
                "content": s["content"],
                "page_range": s.get("page_range"),
                "has_formulas": s.get("has_formulas", False),
                "has_tables": s.get("has_tables", False),
                "has_diagrams": s.get("has_diagrams", False)
            }
            for s in sections
        ]).execute()
    except Exception as e:
        await supabase.storage.from_("notes-pdfs").remove([storage_path])
        logger.exception("Failed to insert note sections", extra={"note_id": note_id})
        raise HTTPException(status_code=500, detail=f"Failed to save note sections: {e}")

    return {
        "note_id": note_id,
        "title": clean_title,
        "file_name": file.filename,
        "sections_extracted": len(sections)
    }


@router.get("/notes/{note_id}/onboard")
@limiter.limit("10/minute")
async def user_onboard(
    request: Request,
    note_id: str,
    user_id: str = Depends(get_current_user_id),
    supabase: AsyncClient = Depends(get_supabase)
):
    # Verify note ownership
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

    # Check for existing lesson plan
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

    # Fetch note sections
    try:
        sections_res = await (
            supabase.table("note_sections")
            .select("section_index, title, content, has_formulas, has_tables, has_diagrams")
            .eq("note_id", note_id)
            .order("section_index")
            .execute()
        )
    except Exception as e:
        logger.exception("Failed to fetch note sections", extra={"note_id": note_id})
        raise HTTPException(status_code=500, detail=f"Failed to fetch note sections: {e}")

    if not sections_res.data:
        raise HTTPException(status_code=404, detail="No content found for this note")

    # Build input for model
    sections_text = "\n\n".join(
        f"Section {s['section_index']}: {s['title']}\n{s['content']}"
        for s in sections_res.data
    )

    # Generate lesson plan
    try:
        response = await client.responses.create(
            model="gpt-4.1-mini",
            instructions=notes_lesson_plan(),
            input=sections_text,
            max_output_tokens=4000,
            text={
                "format": {
                    "type": "json_schema",
                    "name": "lesson_plan_response",
                    "strict": True,
                    "schema": {
                        "type": "object",
                        "properties": {
                            "introduction": {"type": "string"},
                            "sections": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "id": {"type": "integer"},
                                        "title": {"type": "string"},
                                        "classification": {
                                            "type": "string",
                                            "enum": ["DEFINITION_HEAVY", "CONCEPT_DEEP"]
                                        },
                                        "summary": {"type": "string"},
                                        "has_visual_content": {"type": "boolean"},
                                        "learning_objectives": {
                                            "type": "array",
                                            "items": {"type": "string"}
                                        },
                                        "misconceptions": {
                                            "type": "array",
                                            "items": {"type": "string"}
                                        },
                                        "guiding_question": {
                                            "type": ["string", "null"]
                                        },
                                        "visualizations": {
                                            "type": "array",
                                            "items": {
                                                "type": "object",
                                                "properties": {
                                                    "figure_ref": {"type": "string"},
                                                    "description": {"type": "string"}
                                                },
                                                "required": ["figure_ref", "description"],
                                                "additionalProperties": False
                                            }
                                        }
                                    },
                                    "required": ["id", "title", "classification", "summary", "has_visual_content", "learning_objectives", "misconceptions", "guiding_question", "visualizations"],
                                    "additionalProperties": False
                                }
                            },
                            "key_terms": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "term": {"type": "string"},
                                        "definition": {"type": "string"}
                                    },
                                    "required": ["term", "definition"],
                                    "additionalProperties": False
                                }
                            }
                        },
                        "required": ["introduction", "sections", "key_terms"],
                        "additionalProperties": False
                    }
                }
            }
        )
        usage = getattr(response, "usage", None)
        input_tokens = getattr(usage, "input_tokens", 0) or 0
        output_tokens = getattr(usage, "output_tokens", 0) or 0
        input_tokens_details = getattr(usage, "input_tokens_details", None)
        cached_tokens = getattr(input_tokens_details, "cached_tokens", 0) or 0
        usd_cost = ((input_tokens - cached_tokens) * GPT41_MINI_INPUT) + (cached_tokens * GPT41_MINI_CACHED_INPUT) + (output_tokens * GPT41_MINI_OUTPUT)
        asyncio.create_task(log_usage(supabase, user_id, "notes_lesson_plan", "gpt-4.1-mini", input_tokens, output_tokens, usd_cost, cached_tokens=cached_tokens, note_id=note_id))
        if request.state.subscription_status == "free":
            asyncio.create_task(supabase.rpc("deduct_credits", {"p_user_id": user_id, "p_amount": usd_cost / CREDIT_USD_VALUE}).execute())
    except Exception as e:
        logger.exception("Failed to generate lesson plan", extra={"note_id": note_id})
        raise HTTPException(status_code=500, detail=f"Failed to generate lesson plan: {e}")

    generated_plan = response.output_text

    try:
        plan = json.loads(generated_plan)
    except json.JSONDecodeError:
        logger.error("Model returned invalid JSON for lesson plan", extra={"note_id": note_id})
        raise HTTPException(status_code=502, detail="Lesson plan generation returned malformed data. Please try again.")

    if "error" in plan and plan["error"] == "non_stem":
        raise HTTPException(status_code=422, detail=plan["message"])

    # Store lesson plan
    try:
        await (
            supabase.table("note_lesson_plans")
            .insert({"note_id": note_id, "user_id": user_id, "content": generated_plan})
            .execute()
        )
    except Exception as e:
        logger.exception("Failed to store lesson plan", extra={"note_id": note_id})
        raise HTTPException(status_code=500, detail=f"Failed to store lesson plan: {e}")

    return {
        "onboarding_message": format_lesson_plan(plan),
        "lesson_plan": plan
    }


@router.post("/notes/{note_id}/chat")
@limiter.limit("20/minute")
async def notes_chat(
    request: Request,
    background_tasks: BackgroundTasks,
    input: User,
    note_id: str,
    user_id: str = Depends(get_current_user_id),
    supabase: AsyncClient = Depends(get_supabase)
):
    # Verify note ownership
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

    # Phase 1 — fetch everything that doesn't need session_id in parallel
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
                .select("id, current_layer, exchange_count, completed_sections, status, last_summarized_exchange")
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

    # Extract valid section IDs from lesson plan
    try:
        lesson_plan = json.loads(plan_res.data["content"])
        valid_section_ids = {s["id"] for s in lesson_plan.get("sections", [])}
        total_sections = len(valid_section_ids)
        # Build diagram context from lesson plan visualizations
        diagram_context = []
        for s in lesson_plan.get("sections", []):
            vizs = s.get("visualizations", [])
            if vizs:
                section_block = f"Section {s['id']} — {s['title']}:\n" + "\n".join(
                    f"  {v['figure_ref']}: {v['description']}" for v in vizs
                )
                diagram_context.append(section_block)

        diagram_context_text = "\n\n".join(diagram_context) if diagram_context else None
    except (json.JSONDecodeError, KeyError) as e:
        logger.error(f"Failed to parse lesson plan: {e}", extra={"note_id": note_id})
        raise HTTPException(status_code=500, detail="Failed to parse lesson plan")

    # Phase 2 — resolve session (serial: create-if-not-exists can't be parallelised)
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

    # Phase 3 — now session_id is known, fetch latest summary
    try:
        summary_res = await (
            supabase.table("notes_summaries")
                .select("id, summary, exchange_range_end")
                .eq("session_id", session_id)
                .order("created_at", desc=True)
                .limit(1)
                .maybe_single()
                .execute()
        )
        latest_summary = summary_res.data if summary_res else None
    except Exception as e:
        logger.warning(f"Failed to fetch summary, proceeding without: {e}", extra={"note_id": note_id})
        latest_summary = None

    # Get or create progress
    current_layer = "LAYER_1"
    exchange_count = 0

    if not progress_res or not progress_res.data:
        await supabase.table("note_progress").insert({
            "user_id": user_id,
            "note_id": note_id,
            "session_id": session_id,
            "current_layer": "LAYER_1",
            "exchange_count": 0,
            "status": "in_progress",
            "completed_sections": []
        }).execute()
        await log_event(supabase, user_id, session_id, note_id, "lesson_started", {
            "layer": "LAYER_1"
        })
        existing_completed = set()
    else:
        current_layer = progress_res.data["current_layer"]
        exchange_count = progress_res.data["exchange_count"]
        existing_completed = set(progress_res.data.get("completed_sections", []))

    # ---------------------------------------------------------------------------
    # Context assembly
    # history_res is already in chronological order (created_at ASC)
    # Slice to last 10 verbatim turns when a summary exists, otherwise send all
    # ---------------------------------------------------------------------------
    raw_history = list(history_res.data or [])

    if latest_summary:
        verbatim_turns = raw_history[-10:]
        summary_data = latest_summary["summary"]
        summary_block = (
            f"[CONVERSATION SUMMARY — exchanges 1 to {latest_summary['exchange_range_end']}]\n"
            f"Concepts explained: {', '.join(summary_data.get('concepts_explained', []))}\n"
            f"Student misconceptions observed: {', '.join(summary_data.get('student_misconceptions', []) or ['None observed'])}\n"
            f"Key explanations given:\n"
            + "\n".join(f"  - {e}" for e in summary_data.get("key_explanations", []))
            + f"\nWhere the conversation currently stands: {summary_data.get('current_position', '')}\n"
            f"[END SUMMARY]"
        )
        history_for_context = verbatim_turns
    else:
        summary_block = None
        history_for_context = raw_history

    # Build final message list
    clean_content = sanitize_text(input.content)

    assembled_messages = [{"role": "system", "content": notes_chat_generator()}]
    assembled_messages.append({"role": "developer", "content": plan_res.data["content"]})

    if diagram_context_text:
        assembled_messages.append({
            "role": "developer",
            "content": f"# Diagram Reference\nThe following are diagrams present in the student's notes, organized by section. When explaining concepts that reference these figures, ground your explanation in what the diagram actually shows. Use figure_ref to refer to them by name.\n\n{diagram_context_text}"
        })

    if selected_sections:
        sections_context = f"The student has selected sections: {selected_sections}. Focus primarily on these sections."
        assembled_messages.append({"role": "developer", "content": sections_context})

    if summary_block:
        assembled_messages.append({"role": "developer", "content": summary_block})

    assembled_messages.extend(history_for_context)
    assembled_messages.append({"role": input.role, "content": clean_content})

    background_tasks.add_task(update_streak, request.app.state.supabase, user_id)

    # Stream model response
    state = {"accumulated_text": "", "usage": None}

    async def stream_response():
        try:
            stream = await client.responses.create(
                model="gpt-5.4-mini",
                input=assembled_messages,
                max_output_tokens=1500,
                reasoning={"effort": "medium"},
                include=["web_search_call.action.sources"],
                stream=True,
                text={
                    "format": {
                        "type": "json_schema",
                        "name": "chat_response",
                        "strict": True,
                        "schema": {
                            "type": "object",
                            "properties": {
                                "content": {"type": "string"},
                                "layer": {
                                    "type": "string",
                                    "enum": ["LAYER_1", "LAYER_2", "DEFINITION"]
                                },
                                "phase_two": {"type": "boolean"},
                                "completed": {"type": "boolean"},
                                "completed_sections": {
                                    "type": "array",
                                    "items": {"type": "string"}
                                },
                                "visualizations": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "index": {"type": "integer"},
                                            "concept_description": {"type": "string"},
                                            "scene_type": {
                                                "type": "string",
                                                "enum": ["SHAPE_DIAGRAM", "GRAPH_PLOT", "NUMBER_LINE", "FORMULA_BREAKDOWN"]
                                            }
                                        },
                                        "required": ["index", "concept_description", "scene_type"],
                                        "additionalProperties": False
                                    }
                                },
                                "emitted_viz_indices": {
                                    "type": "array",
                                    "items": {"type": "integer"}
                                }
                            },
                            "required": ["content", "layer", "phase_two", "completed", "completed_sections", "visualizations", "emitted_viz_indices"],
                            "additionalProperties": False
                        }
                    }
                }
            )

            async for event in stream:
                if event.type == "response.output_text.delta":
                    delta = event.delta
                    if delta:
                        state["accumulated_text"] += delta
                        yield f"data: {delta}\n\n"
                if event.type == "response.completed":
                    completed_response = getattr(event, "response", None)
                    state["usage"] = getattr(completed_response, "usage", None)

            if state["usage"]:
                input_tokens = getattr(state["usage"], "input_tokens", 0) or 0
                output_tokens = getattr(state["usage"], "output_tokens", 0) or 0
                input_tokens_details = getattr(state["usage"], "input_tokens_details", None)
                cached_tokens = getattr(input_tokens_details, "cached_tokens", 0) or 0
                usd_cost = ((input_tokens - cached_tokens) * GPT54_MINI_INPUT) + (cached_tokens * GPT54_MINI_CACHED_INPUT) + (output_tokens * GPT54_MINI_OUTPUT)
                asyncio.create_task(log_usage(supabase, user_id, "notes_chat", "gpt-5.4-mini", input_tokens, output_tokens, usd_cost, cached_tokens=cached_tokens, note_id=note_id))
                if request.state.subscription_status == "free":
                    asyncio.create_task(supabase.rpc("deduct_credits", {"p_user_id": user_id, "p_amount": usd_cost / CREDIT_USD_VALUE}).execute())

            try:
                response_dict = json.loads(state["accumulated_text"])
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse streamed JSON. Error: {e}. Length: {len(state['accumulated_text'])}", extra={"note_id": note_id})
                yield "data: [DONE]\n\n"
                return

            try:
                model_completed_sections = set(int(s) for s in response_dict.get("completed_sections", []) if str(s).isdigit()) | existing_completed
                valid_completed = model_completed_sections & valid_section_ids
                percentage = int(len(valid_completed) / total_sections * 100) if total_sections > 0 else 0
            except Exception:
                percentage = 0

            yield f"data: [PROGRESS] {percentage}\n\n"
            yield "data: [DONE]\n\n"

            visualizations = response_dict.get("visualizations", [])
            background_tasks.add_task(
                process_visualizations,
                visualizations=visualizations,
                session_id=session_id,
                user_id=user_id,
                source_id=note_id,
                source_type="note",
                supabase=supabase
            )

        except Exception as e:
            logger.exception("Streaming failed", extra={"note_id": note_id})
            yield f"data: [ERROR] {str(e)}\n\n"
            return

        completed = response_dict.get("completed", False)
        new_layer = response_dict.get("layer", current_layer)
        clean_content_for_db = response_dict["content"].strip()
        new_exchanges_count = exchange_count + 1

        update_data = {
            "exchange_count": new_exchanges_count,
            "current_layer": new_layer,
            "completed_sections": list(valid_completed),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }

        if completed:
            update_data["status"] = "completed"
            update_data["completed_at"] = datetime.now(timezone.utc).isoformat()

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
                        "content": clean_content_for_db
                    }
                ]).execute(),

                supabase.table("note_progress")
                    .update(update_data)
                    .eq("user_id", user_id)
                    .eq("note_id", note_id)
                    .execute()
            )

            if completed:
                await log_event(supabase, user_id, session_id, note_id, "lesson_completed", {
                    "layer": new_layer,
                    "exchange_count": new_exchanges_count
                })

        except Exception as e:
            logger.exception("Failed to write conversation/progress after stream", extra={"note_id": note_id})
            return  # Don't trigger summarization if DB write failed

        # ---------------------------------------------------------------------------
        # Rolling summarization — triggers every 20 exchanges, post-write
        # new_exchange_count is already incremented so the check is straightforward
        # ---------------------------------------------------------------------------
        if new_exchanges_count % 20 == 0:
            asyncio.create_task(
                generate_rolling_summary(
                    supabase=supabase,
                    user_id=user_id,
                    source_id=note_id,
                    session_id=session_id,
                    new_exchange_count=new_exchanges_count,
                    previous_summary=latest_summary["summary"] if latest_summary else None,
                    previous_summary_range_end=latest_summary["exchange_range_end"] if latest_summary else 0,
                    source="note"
                )
            )

    return StreamingResponse(
        stream_response(),
        background=background_tasks,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no"
        }
    )



@router.post("/courses")
@limiter.limit("10/minute")
async def create_course(
    request: Request,
    input: Course,
    supabase: AsyncClient = Depends(get_supabase),
    user_id: str = Depends(get_current_user_id)
):
    try:
        response = await (
            supabase.table("user_courses")
            .insert({
                "user_id": user_id,
                "name": input.name,
                "course_code": input.course_code,
                "description": input.description
            })
            .execute()
        )
    except Exception as e:
        logger.exception("Failed to create course")
        raise HTTPException(status_code=502, detail=f"Failed to create course: {e}")

    return response.data[0]


@router.get("/courses")
async def get_courses(
    request: Request,
    supabase: AsyncClient = Depends(get_supabase),
    user_id: str = Depends(get_current_user_id)
):
    try:
        response = await (
            supabase.table("user_courses")
            .select("id, name, course_code, description")
            .eq("user_id", user_id)
            .execute()
        )
    except Exception as e:
        logger.exception("Failed to get courses")
        raise HTTPException(status_code=502, detail=f"Failed to get courses: {e}")

    return response.data


@router.get("/courses/{course_id}/notes")
async def get_notes(
    request: Request,
    course_id: str,
    supabase: AsyncClient = Depends(get_supabase),
    user_id: str = Depends(get_current_user_id)
):
    try:
        notes_list = await (
            supabase.table("notes")
            .select("id, title, file_url, created_at")
            .eq("user_id", user_id)
            .eq("course_id", course_id)
            .execute()
        )
    except Exception as e:
        logger.exception("Failed to get notes")
        raise HTTPException(status_code=502, detail=f"Failed to get notes: {e}")

    return notes_list.data


@router.delete("/courses/{course_id}")
@limiter.limit("10/minute")
async def delete_course(
    request: Request,
    course_id: str,
    supabase: AsyncClient = Depends(get_supabase),
    user_id: str = Depends(get_current_user_id)
):
    # Verify ownership before touching anything
    try:
        course_res = await (
            supabase.table("user_courses")
                .select("id")
                .eq("id", course_id)
                .eq("user_id", user_id)
                .maybe_single()
                .execute()
        )
    except Exception as e:
        logger.exception("Failed to verify course ownership", extra={"course_id": course_id})
        raise HTTPException(status_code=500, detail=f"Failed to verify course: {e}")

    if not course_res or not course_res.data:
        raise HTTPException(status_code=404, detail="Course not found")

    # Null out course_id on all notes that belonged to this course
    try:
        await (
            supabase.table("notes")
                .update({"course_id": None})
                .eq("course_id", course_id)
                .eq("user_id", user_id)
                .execute()
        )
    except Exception as e:
        logger.exception("Failed to unlink notes from course", extra={"course_id": course_id})
        raise HTTPException(status_code=500, detail=f"Failed to unlink notes: {e}")

    # Delete the course entry
    try:
        await (
            supabase.table("user_courses")
                .delete()
                .eq("id", course_id)
                .eq("user_id", user_id)
                .execute()
        )
    except Exception as e:
        logger.exception("Failed to delete course", extra={"course_id": course_id})
        raise HTTPException(status_code=500, detail=f"Failed to delete course: {e}")

    return {"detail": "Course deleted. Associated notes moved to uncategorized."}

@router.get("/notes/{note_id}/history")
async def note_chat_history(
    request: Request,
    note_id: str,
    user_id: str = Depends(get_current_user_id),
    supabase: AsyncClient = Depends(get_supabase)
):
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
        logger.exception("Failed to get history")
        raise HTTPException(status_code=502, detail=f"Failed to get history: {e}")

    return response.data


@router.get("/visualizations/status")
async def visualization_status(
    request: Request,
    session_id: str,
    user_id: str = Depends(get_current_user_id),
    supabase: AsyncClient = Depends(get_supabase)
):
    try:
        response = await (
            supabase.table("visualizations")
            .select("viz_index, render_status, video_url")
            .eq("session_id", session_id)
            .eq("user_id", user_id)
            .order("viz_index")
            .execute()
        )
    except Exception as e:
        logger.exception("Failed to get visualization status", extra={"session_id": session_id})
        raise HTTPException(status_code=502, detail=f"Failed to get visualization status: {e}")

    return {"visualizations": response.data or []}


class QuizRequest(BaseModel):
    selected_sections: list[int]


class QuizAttemptItem(BaseModel):
    question: str
    type: str
    user_answer: str
    correct_answer: str
    is_correct: bool
    difficulty: str
    selected_sections: Optional[List[int]] = None


class QuizSubmitRequest(BaseModel):
    quiz_session_id: Optional[str] = None
    session_id: Optional[str] = None
    score: int
    total: int
    attempts: List[QuizAttemptItem]


@router.get("/quiz/{note_id}")
async def get_section_details(
    request: Request,
    note_id: str,
    user_id: str = Depends(get_current_user_id),
    supabase: AsyncClient = Depends(get_supabase)
):
    """Return the note's sections (id + title) for the quiz section picker."""
    try:
        res = await (
            supabase.table("note_lesson_plans")
            .select("content")
            .eq("note_id", note_id)
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
    except Exception as e:
        logger.exception("Failed to fetch section details", extra={"note_id": note_id})
        raise HTTPException(status_code=502, detail=f"Couldn't obtain section details: {e}")

    if not res or not res.data:
        raise HTTPException(status_code=404, detail="Lesson plan not found.")

    try:
        plan = json.loads(res.data["content"])
        sections = plan["sections"]
    except (json.JSONDecodeError, KeyError):
        raise HTTPException(status_code=500, detail="Lesson data is corrupt")

    return [{"id": s["id"], "title": s["title"]} for s in sections]


@router.post("/notes/{note_id}/quiz")
@limiter.limit("10/minute")
async def generate_quiz(
    request: Request,
    input: QuizRequest,
    note_id: str,
    user_id: str = Depends(get_current_user_id),
    supabase: AsyncClient = Depends(get_supabase)
):
    session_id = str(uuid.uuid4())

    if not input.selected_sections:
        raise HTTPException(status_code=400, detail="No sections selected")

    # Verify note ownership
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


    # Fetch relevant sections
    try:
        sections_res = await (
            supabase.table("note_sections")
            .select("section_index, title, content")
            .eq("note_id", note_id)
            .in_("section_index", input.selected_sections)
            .order("section_index")
            .execute()
        )
    except Exception as e:
        logger.exception("Failed to fetch note sections", extra={"note_id": note_id})
        raise HTTPException(status_code=500, detail=f"Failed to fetch note sections: {e}")

    if not sections_res.data:
        raise HTTPException(status_code=404, detail="No content found for selected sections")

    sections_text = "\n\n".join(
        f"Section {s['section_index']}: {s['title']}\n{s['content']}"
        for s in sections_res.data
    )

    # Generate quiz
    try:
        response = await client.responses.create(
            model="gpt-4.1-mini",
            instructions=notes_quiz_generator(),
            input=sections_text,
            max_output_tokens=8000,
            store=True,
            text={
            "format": {
                "type": "json_schema",
                "name": "quiz_response",
                "strict": True,
                "schema": {
                    "type": "object",
                    "properties": {
                        "questions": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "question": {"type": "string"},
                                    "type": {"type": "string", "enum": ["multiple_choice", "true_false"]},
                                    "options": {"type": "array", "items": {"type": "string"}},
                                    "answer": {"type": "string"},
                                    "explanation": {"type": "string"},
                                    "difficulty": {"type": "string", "enum": ["easy", "medium", "hard"]}
                                },
                                "required": ["question", "type", "options", "answer", "explanation", "difficulty"],
                                "additionalProperties": False
                            }
                        }
                    },
                    "required": ["questions"],
                    "additionalProperties": False
                }
            }
        }
        )
        usage = getattr(response, "usage", None)
        input_tokens = getattr(usage, "input_tokens", 0) or 0
        output_tokens = getattr(usage, "output_tokens", 0) or 0
        input_tokens_details = getattr(usage, "input_tokens_details", None)
        cached_tokens = getattr(input_tokens_details, "cached_tokens", 0) or 0
        usd_cost = ((input_tokens - cached_tokens) * GPT41_MINI_INPUT) + (cached_tokens * GPT41_MINI_CACHED_INPUT) + (output_tokens * GPT41_MINI_OUTPUT)
        asyncio.create_task(log_usage(supabase, user_id, "notes_quiz", "gpt-4.1-mini", input_tokens, output_tokens, usd_cost, cached_tokens=cached_tokens, note_id=note_id))
        if request.state.subscription_status == "free":
            asyncio.create_task(supabase.rpc("deduct_credits", {"p_user_id": user_id, "p_amount": usd_cost / CREDIT_USD_VALUE}).execute())
    except Exception as e:
        logger.exception("Failed to generate quiz", extra={"note_id": note_id})
        raise HTTPException(status_code=500, detail=f"Failed to generate quiz: {e}")

    # Parse quiz
    try:
        response_dict = json.loads(response.output[0].content[0].text)
        questions = response_dict["questions"]
    except (json.JSONDecodeError, IndexError, AttributeError, KeyError):
        logger.error("Model returned invalid JSON for quiz", extra={"note_id": note_id})
        raise HTTPException(status_code=502, detail="Quiz generation returned malformed data. Please try again.")

    rows = [
        {
            "user_id": user_id,
            "note_id": note_id,
            "selected_sections": input.selected_sections,
            "questions": json.dumps({
                "question": q["question"],
                "type": q["type"],
                "options": q.get("options", [])
            }),
            "answers": json.dumps({
                "answer": q["answer"],
                "explanation": q["explanation"],
                "difficulty": q["difficulty"]
            })
        }
        for q in questions
    ]

    # Store quiz
    try:
        quiz_res = await (
            supabase.table("note_quizzes")
            .insert(rows)
            .execute()
        )
    except Exception as e:
        logger.exception("Failed to store quiz", extra={"note_id": note_id})
        raise HTTPException(status_code=500, detail=f"Failed to save quiz: {e}")

    await log_event(supabase, user_id, session_id, note_id, "quiz_started", {
        "quiz_session_id": session_id,
        "session_id": session_id,
        "source": "notes",
        "selected_sections": input.selected_sections,
        "question_count": len(questions)
    })

    # Merge and return
    return {
        "quiz_session_id": session_id,
        "session_id": session_id,
        "questions": questions
    }


@router.post("/notes/{note_id}/quiz/submit")
@limiter.limit("5/minute")
async def submit_quiz(
    request: Request,
    input: QuizSubmitRequest,
    note_id: str,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
    supabase: AsyncClient = Depends(get_supabase)
):
    session_id = input.session_id or input.quiz_session_id
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")

    # Verify note ownership
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

    rows = [
        {
            "user_id": user_id,
            "note_id": note_id,
            "quiz_session_id": session_id,
            "question": a.question,
            "type": a.type,
            "user_answer": a.user_answer,
            "correct_answer": a.correct_answer,
            "is_correct": a.is_correct,
            "difficulty": a.difficulty,
            "selected_sections": a.selected_sections
        }
        for a in input.attempts
    ]

    background_tasks.add_task(update_streak, request.app.state.supabase, user_id)    # Store quiz attempts
    try:
        await (
            supabase.table("note_question_attempts")
            .insert(rows)
            .execute()
        )
    except Exception as e:
        logger.exception("Failed to store quiz attempts", extra={"note_id": note_id})
        raise HTTPException(status_code=500, detail=f"Failed to save quiz attempts: {e}")

    await log_event(supabase, user_id, session_id, note_id, "quiz_completed", {
        "quiz_session_id": session_id,
        "session_id": session_id,
        "score": input.score,
        "total": input.total
    })

    return {"message": "Quiz attempt saved successfully"}


@router.post("/notes/{note_id}/flashcards")
@limiter.limit("10/minute")
async def get_or_create_flashcards(
    request: Request,
    input: QuizRequest,  # reuse since it has selected_sections
    note_id: str,
    user_id: str = Depends(get_current_user_id),
    supabase: AsyncClient = Depends(get_supabase)
):
    session_id = str(uuid.uuid4())

    if not input.selected_sections:
        raise HTTPException(status_code=400, detail="No sections selected")

    # Verify note ownership
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

    # Check if flashcards exist for selected sections
    try:
        existing_res = await (
            supabase.table("note_flashcards")
            .select("id, question, answer")
            .eq("note_id", note_id)
            .eq("user_id", user_id)
            .filter("selected_sections", "cs", json.dumps(input.selected_sections))
            .execute()
        )
    except Exception as e:
        logger.exception("Failed to check existing flashcards", extra={"note_id": note_id})
        raise HTTPException(status_code=500, detail=f"Failed to check existing flashcards: {e}")

    if existing_res.data:
        await log_event(supabase, user_id, session_id, note_id, "flashcard_started", {
            "session_id": session_id,
            "selected_sections": input.selected_sections,
            "flashcard_count": len(existing_res.data),
            "source": "notes",
            "cache": True
        })
        return {"flashcards": existing_res.data, "source": "cache", "session_id": session_id}


    # Fetch relevant sections
    try:
        sections_res = await (
            supabase.table("note_sections")
            .select("section_index, title, content")
            .eq("note_id", note_id)
            .in_("section_index", input.selected_sections)
            .order("section_index")
            .execute()
        )
    except Exception as e:
        logger.exception("Failed to fetch note sections", extra={"note_id": note_id})
        raise HTTPException(status_code=500, detail=f"Failed to fetch note sections: {e}")

    if not sections_res.data:
        raise HTTPException(status_code=404, detail="No content found for selected sections")

    sections_text = "\n\n".join(
    f"Section {s['section_index']}: {s['title']}\n{s['content']}"
    for s in sections_res.data
    )

    # Generate flashcards
    try:
        response = await client.responses.create(
            model="gpt-4.1-mini",
            instructions=(
                "Generate flashcards for students to use to memorize facts from the note data given. "
                "Return a JSON array and nothing else. Each element must have exactly two fields: "
                "{'question': 'the front of the flashcard', 'answer': 'the back of the flashcard'}. "
                "No preamble, no markdown, no explanation â€” only the JSON array."
            ),
            input=sections_text,
            store=True
        )
        usage = getattr(response, "usage", None)
        input_tokens = getattr(usage, "input_tokens", 0) or 0
        output_tokens = getattr(usage, "output_tokens", 0) or 0
        input_tokens_details = getattr(usage, "input_tokens_details", None)
        cached_tokens = getattr(input_tokens_details, "cached_tokens", 0) or 0
        usd_cost = ((input_tokens - cached_tokens) * GPT41_MINI_INPUT) + (cached_tokens * GPT41_MINI_CACHED_INPUT) + (output_tokens * GPT41_MINI_OUTPUT)
        asyncio.create_task(log_usage(supabase, user_id, "notes_flashcards", "gpt-4.1-mini", input_tokens, output_tokens, usd_cost, cached_tokens=cached_tokens, note_id=note_id))
        if request.state.subscription_status == "free":
            asyncio.create_task(supabase.rpc("deduct_credits", {"p_user_id": user_id, "p_amount": usd_cost / CREDIT_USD_VALUE}).execute())
    except Exception as e:
        logger.exception("Failed to generate flashcards", extra={"note_id": note_id})
        raise HTTPException(status_code=500, detail=f"Failed to generate flashcards: {e}")

    # Parse response
    try:
        raw = response.output_text.strip()
        flashcards = json.loads(raw)
        if not isinstance(flashcards, list):
            raise ValueError("Expected a JSON array")
    except (json.JSONDecodeError, ValueError):
        logger.error("Model returned invalid JSON for flashcards", extra={"note_id": note_id})
        raise HTTPException(status_code=502, detail="Flashcard generation returned malformed data. Please try again.")

    # Store flashcards as individual rows
    try:
        rows = [
            {
                "user_id": user_id,
                "note_id": note_id,
                "selected_sections": input.selected_sections,
                "question": f["question"],
                "answer": f["answer"]
            }
            for f in flashcards
        ]
        await (
            supabase.table("note_flashcards")
            .insert(rows)
            .execute()
        )
    except Exception as e:
        logger.exception("Failed to store flashcards", extra={"note_id": note_id})
        raise HTTPException(status_code=500, detail=f"Failed to save flashcards: {e}")

    await log_event(
        supabase,
        user_id,
        session_id,
        note_id,
        "flashcard_started",
        {
            "session_id": session_id,
            "selected_sections": input.selected_sections,
            "flashcard_count": len(rows),
            "source": "notes",
            "cache": False
        }
    )

    return {"flashcards": flashcards, "source": "generated", "session_id": session_id}


@router.post("/notes/{note_id}/flashcards/generate")
@limiter.limit("10/minute")
async def generate_flashcards(
    request: Request,
    input: QuizRequest,
    note_id: str,
    user_id: str = Depends(get_current_user_id),
    supabase: AsyncClient = Depends(get_supabase)
):
    session_id = str(uuid.uuid4())

    if not input.selected_sections:
        raise HTTPException(status_code=400, detail="No sections selected")

    # Verify note ownership
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


    # Fetch relevant sections
    try:
        sections_res = await (
            supabase.table("note_sections")
            .select("section_index, title, content")
            .eq("note_id", note_id)
            .in_("section_index", input.selected_sections)
            .order("section_index")
            .execute()
        )
    except Exception as e:
        logger.exception("Failed to fetch note sections", extra={"note_id": note_id})
        raise HTTPException(status_code=500, detail=f"Failed to fetch note sections: {e}")

    if not sections_res.data:
        raise HTTPException(status_code=404, detail="No content found for selected sections")

    sections_text = "\n\n".join(
    f"Section {s['section_index']}: {s['title']}\n{s['content']}"
    for s in sections_res.data
)

    # Generate flashcards
    try:
        response = await client.responses.create(
            model="gpt-4.1-mini",
            instructions=(
                "Generate flashcards for students to use to memorize facts from the note data given. "
                "Return a JSON array and nothing else. Each element must follow this exact schema: "
                f"{{'question': 'the front of the flashcard', 'answer': 'the back of the flashcard'}}. "
                "No preamble, no markdown, no explanation â€” only the JSON array."
            ),
            input=sections_text,
            store=True
        )
        usage = getattr(response, "usage", None)
        input_tokens = getattr(usage, "input_tokens", 0) or 0
        output_tokens = getattr(usage, "output_tokens", 0) or 0
        input_tokens_details = getattr(usage, "input_tokens_details", None)
        cached_tokens = getattr(input_tokens_details, "cached_tokens", 0) or 0
        usd_cost = ((input_tokens - cached_tokens) * GPT41_MINI_INPUT) + (cached_tokens * GPT41_MINI_CACHED_INPUT) + (output_tokens * GPT41_MINI_OUTPUT)
        asyncio.create_task(log_usage(supabase, user_id, "notes_flashcards", "gpt-4.1-mini", input_tokens, output_tokens, usd_cost, cached_tokens=cached_tokens, note_id=note_id))
        if request.state.subscription_status == "free":
            asyncio.create_task(supabase.rpc("deduct_credits", {"p_user_id": user_id, "p_amount": usd_cost / CREDIT_USD_VALUE}).execute())
    except Exception as e:
        logger.exception("Failed to generate flashcards", extra={"note_id": note_id})
        raise HTTPException(status_code=500, detail=f"Failed to generate flashcards: {e}")

    # Parse response
    try:
        raw = response.output_text.strip()
        flashcards = json.loads(raw)
        if not isinstance(flashcards, list):
            raise ValueError("Expected a JSON array")
    except (json.JSONDecodeError, ValueError):
        logger.error("Model returned invalid JSON for flashcards", extra={"note_id": note_id})
        raise HTTPException(status_code=502, detail="Flashcard generation returned malformed data. Please try again.")

    # Store flashcards as individual rows
    try:
        rows = [
            {
                "user_id": user_id,
                "note_id": note_id,
                "selected_sections": input.selected_sections,
                "question": f["question"],
                "answer": f["answer"]
            }
            for f in flashcards
        ]
        await (
            supabase.table("note_flashcards")
            .insert(rows)
            .execute()
        )
    except Exception as e:
        logger.exception("Failed to store flashcards", extra={"note_id": note_id})
        raise HTTPException(status_code=500, detail=f"Failed to save flashcards: {e}")

    await log_event(
        supabase,
        user_id,
        session_id,
        note_id,
        "flashcard_started",
        {
            "session_id": session_id,
            "selected_sections": input.selected_sections,
            "flashcard_count": len(rows),
            "source": "notes",
            "regenerated": True
        }
    )

    return {"flashcards": flashcards, "session_id": session_id}