from fastapi import APIRouter, HTTPException, Depends, Request
from supabase import AsyncClient
from app.core.deps import get_supabase
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta

from app.auth.verify import get_current_user, get_current_user_id
from app.auth.config import MONTHLY_PLAN_PRICE, YEARLY_PLAN_PRICE, PRO_MONTHLY, PRO_YEARLY, PAYSTACK_SECRET_KEY, CALLBACK_URL
import httpx
import hmac
import hashlib
import logging
import asyncio
import json

logger = logging.getLogger(__name__)

router = APIRouter()


def verify_paystack_signature(payload: bytes, signature: str, secret: str) -> bool:
    expected = hmac.new(
        secret.encode("utf-8"),
        payload,
        hashlib.sha512
    ).hexdigest()
    return hmac.compare_digest(expected, signature)

class User_Plan(BaseModel):
    plan: str

@router.get("/payments/webhook")
async def verify_webhook(token: str = None):
    return {"token": token}

@router.post("/payments/initiate")
async def initialize_payment(
    user_plan: User_Plan,
    user: str = Depends(get_current_user),
    supabase: AsyncClient = Depends(get_supabase)):

    user_email = user.get("email")

    if user_plan.plan == 'pro_monthly':
        amount = MONTHLY_PLAN_PRICE
        plan = PRO_MONTHLY
    elif user_plan.plan == 'pro_yearly':
        amount = YEARLY_PLAN_PRICE
        plan = PRO_YEARLY
    else:
        raise HTTPException(status_code=400, detail="Invalid plan type")

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.paystack.co/transaction/initialize",
                headers = {
                    "Authorization": f"Bearer {PAYSTACK_SECRET_KEY}",
                    "Content-Type": "application/json"
                },
                json = {
                    "email": user_email,
                    "amount": amount,
                    "plan": plan,
                    "callback_url": CALLBACK_URL,
                        "metadata": {
                            "user_id": user["user_id"]
                        }
                }
            )
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Payment provider timed out")
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="Could not reach payment provider")

    data = response.json()
    if response.status_code != 200 or not data.get("status"):
        raise HTTPException(status_code=502, detail="Payment initialization failed")

    frontend_url = data["data"].get("authorization_url")

    return {"payment_url": frontend_url}

@router.post("/payments/webhook")
async def webhook(request: Request, supabase: AsyncClient = Depends(get_supabase)):
    payload = await request.body()
    signature = request.headers.get("x-paystack-signature")
    if not signature:
        raise HTTPException(status_code=401, detail="Missing signature")

    verify = verify_paystack_signature(payload=payload, signature=signature, secret=PAYSTACK_SECRET_KEY)

    if not verify:
        raise HTTPException(status_code=401, detail="Invalid signature")

    body = json.loads(payload)
    reference = body["data"].get("reference")
    try:
        ref_check = await (
            supabase.table("processed_payment_references")
            .select("reference")
            .eq("reference", reference)
            .execute()
        )
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"status": "ok"}

    if ref_check.data:
        return {"status": "ok"}
    
    event = body["event"]

    if event == "charge.success":
        customer_code = body["data"]["customer"]["customer_code"]
        plan_code = body["data"]["plan"]["plan_code"]
        paid_at = datetime.fromisoformat(body["data"]["paid_at"].replace("Z", "+00:00"))

        if plan_code == PRO_MONTHLY:
            plan_type = "pro_monthly"
            current_period_end = paid_at + timedelta(days=30)
        elif plan_code == PRO_YEARLY:
            plan_type = "pro_yearly"
            current_period_end = paid_at + timedelta(days=365)
        else:
            logger.error(f"Unknown plan code: {plan_code}")
            return {"status": "ok"}

        lapse_deadline = current_period_end + timedelta(days=3)

        user_id = body["data"]["metadata"]["user_id"]

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"https://api.paystack.co/customer/{customer_code}",
                    headers= {"Authorization": f"Bearer {PAYSTACK_SECRET_KEY}"}
                )
        except httpx.TimeoutException:
            logger.error("Payment provider timed out")
            return {"status": "ok"}
        except httpx.RequestError:
            logger.error("Could not reach payment provider")
            return {"status": "ok"}

        customer = response.json()
        customer_id = customer["data"]["id"]

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"https://api.paystack.co/subscription?customer={customer_id}",
                    headers= {"Authorization": f"Bearer {PAYSTACK_SECRET_KEY}"}
                )

        except httpx.TimeoutException:
            logger.error("Payment provider timed out")
            return {"status": "ok"}
        except httpx.RequestError:
            logger.error("Could not reach payment provider")
            return {"status": "ok"}

        customer_data = response.json()

        if not customer_data.get("status") or not customer_data["data"]:
            logger.error(f"No subscription found for customer {customer_id}")
            return {"status": "ok"}

        subscription_code = customer_data["data"][0]["subscription_code"]
        email_token = customer_data["data"][0]["email_token"]

        try:
            update = await (
                supabase.table("subscriptions")
                .upsert({
                    "user_id": user_id,
                    "plan_type": plan_type,
                    "status": "active",
                    "paystack_customer_id": customer_id,
                    "paystack_customer_code": customer_code,
                    "paystack_subscription_code": subscription_code,
                    "paystack_email_token": email_token,
                    "current_period_end": current_period_end.isoformat(),
                    "lapse_deadline": lapse_deadline.isoformat()
                },
                on_conflict="user_id")
                .execute()
            )
        except Exception as e:
            logger.error(f"Webhook error: {e}")
            return {"status": "ok"}

        try:
            await (
                supabase.table("user_credits")
                .update({"subscription_status": "paid"})
                .eq("user_id", user_id)
                .execute()
            )
        except Exception as e:
            logger.error(f"Webhook error: {e}")
            return {"status": "ok"}

    elif event == "invoice.payment_failed":
        user_id = body["data"]["metadata"]["user_id"]

        try:
            await (
                supabase.table("subscriptions")
                .update({"status": "lapsed"})
                .eq("user_id", user_id)
                .execute()
            )
        except Exception as e:
            logger.error(f"Webhook error: {e}")
            return {"status": "ok"}

    elif event == "subscription.disable":
        user_id = body["data"]["metadata"]["user_id"]

        try:
            await asyncio.gather(
                supabase.table("subscriptions")
                .update({"status": "cancelled"})
                .eq("user_id", user_id)
                .execute(),

                supabase.table("user_credits")
                .update({"subscription_status": "free"})
                .eq("user_id", user_id)
                .execute()
            )
        except Exception as e:
            logger.error(f"Webhook error: {e}")
            return {"status": "ok"}

    try:
        await (
            supabase.table("processed_payment_references")
            .insert({"reference": reference})
            .execute()
        )
    except Exception as e:
        logger.error(f"Failed to record reference: {e}")
        return {"status": "ok"}

    return {"status": "ok"}

@router.get("/subscriptions")
async def get_subscription(
    user_id: str = Depends(get_current_user_id),
    supabase: AsyncClient = Depends(get_supabase),
):
    """Return the caller's subscription record for the profile/billing UI.

    Reads the `subscriptions` table (safe fields only — no Paystack codes).
    Users with no row are reported as free.
    """
    try:
        res = await (
            supabase.table("subscriptions")
            .select("plan_type, status, current_period_end")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
    except Exception as e:
        logger.error(f"Failed to fetch subscription: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch subscription")

    row = (res.data if res else None) or {}
    return {
        "subscription_status": row.get("status") or "free",
        "plan_type": row.get("plan_type"),
        "current_period_end": row.get("current_period_end"),
    }


@router.delete("/subscriptions/cancel")
async def cancel_subscription(user_id: str = Depends(get_current_user_id), supabase: AsyncClient = Depends(get_supabase)):
    try:
        user_sub_details = await (
            supabase.table("subscriptions")
            .select("paystack_subscription_code, paystack_email_token")
            .eq("user_id", user_id)
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail= f"Couldn't access data for said user. Details: {e}")
    
    if not user_sub_details.data:
        raise HTTPException(status_code=404, detail="No active subscription found")

    sub_code = user_sub_details.data[0]["paystack_subscription_code"]
    email_tk = user_sub_details.data[0]["paystack_email_token"]

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.paystack.co/subscription/disable",
                headers = {
                    "Authorization": f"Bearer {PAYSTACK_SECRET_KEY}",
                    "Content-Type": "application/json"
                },
                json = {
                    "code": sub_code,
                    "token": email_tk
                }
            )

    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Payment provider timed out")
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="Could not reach payment provider")
    
    data = response.json()

    if data["status"] == True:
        try:
            await (
                supabase.table("subscriptions")
                .update({"status": "cancelled"})
                .eq("user_id", user_id)
                .execute()
            )
            
        except Exception as e:
            raise HTTPException(status_code=502, detail= f"Could not update data. Details: {e}")
    else:
        raise HTTPException(status_code=502, detail="Paystack could not disable subscription")

    return {"message": "Subscription cancelled successfully"}