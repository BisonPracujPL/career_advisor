import asyncio
import json
import os
import re

from django.http import StreamingHttpResponse, HttpResponseNotAllowed
from django.views.decorators.csrf import csrf_exempt
from mcp.client.stdio import stdio_client, StdioServerParameters
from mcp.client.session import ClientSession

from apps.job_market.services.career_chat_context import (
    CHAT_COURSE_INSTRUCTIONS,
    CHAT_DATA_RULES,
    CHAT_RAG_INSTRUCTIONS,
    CHAT_SALARY_STYLE_INSTRUCTIONS,
    CHAT_STYLE_INSTRUCTIONS,
    build_chat_facts,
    build_chat_rag_query,
    format_chat_context_block,
    format_chat_facts_json,
)
from apps.job_market.services.chat_chart_guard import (
    apply_chart_guard_for_key,
    pick_auto_salary_chart,
    render_radar_chart_url,
)
from apps.job_market.services.rag_service import retrieve_context

SERVER_PARAMS = StdioServerParameters(
    command="mcp-server-chart",
    args=[]
)

AI_MODEL = "openai/gpt-5.6-terra"

# Lower temperature → less hallucination, more factual / grounded answers.
AI_TEMPERATURE = 0.2


def get_user_profile_sync(user):
    if not user.is_authenticated:
        return {}
    try:
        profile = getattr(user, "profile", None)
        return profile.profile_data if profile else {}
    except Exception:
        return {}


async def _fetch_mcp_tools():
    """Connect to the MCP chart stdio server and return OpenAI-formatted tools list."""
    async with stdio_client(SERVER_PARAMS) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            tools_resp = await session.list_tools()
            return [
                {
                    "type": "function",
                    "function": {
                        "name": t.name,
                        "description": t.description,
                        "parameters": t.inputSchema,
                    },
                }
                for t in tools_resp.tools
            ]


async def _call_mcp_tool(tool_name: str, arguments: dict) -> str:
    """Call a single MCP chart tool and return its text result."""
    async with stdio_client(SERVER_PARAMS) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            result = await session.call_tool(tool_name, arguments=arguments)
            return result.content[0].text if result.content else ""


def _chart_markdown(mcp_result: str) -> str | None:
    """MCP returns a bare URL — wrap as markdown image for ReactMarkdown."""
    text = (mcp_result or "").strip()
    if not text:
        return None
    if text.startswith("!["):
        return text
    if text.startswith("http://") or text.startswith("https://"):
        return f"![]({text})"
    return None


_CHART_MARKDOWN_RE = re.compile(
    r"!\[[^\]]*\]\(\s*https?://[^\s)]+\s*\)"
    r"|https?://\S*alipayobjects\.com/\S*",
    re.IGNORECASE,
)
_CHART_JSON_LEAK_RE = re.compile(
    r"```(?:json)?\s*\[[\s\S]*?\"category\"[\s\S]*?\"value\"[\s\S]*?\]\s*```",
    re.IGNORECASE,
)
_RADAR_JSON_LEAK_RE = re.compile(
    r"```(?:json)?\s*\[[\s\S]*?\"name\"[\s\S]*?\"value\"[\s\S]*?\]\s*```",
    re.IGNORECASE,
)
_CHART_HTML_IMG_RE = re.compile(
    r"<img\b[^>]*alipayobjects[^>]*/?\s*>",
    re.IGNORECASE,
)


def _strip_llm_chart_markdown(text: str, *, chart_key: str | None = None) -> str:
    """Remove duplicate chart images/URLs and chart-data JSON leaks from LLM output."""
    if not text:
        return text
    cleaned = _CHART_MARKDOWN_RE.sub("", text)
    cleaned = _CHART_HTML_IMG_RE.sub("", cleaned)
    cleaned = _CHART_JSON_LEAK_RE.sub("", cleaned)
    if chart_key == "salary_by_pillar_radar":
        cleaned = _RADAR_JSON_LEAK_RE.sub("", cleaned)
    return re.sub(r"\n{3,}", "\n\n", cleaned)


def _prioritize_unmentioned_learning_skills(
    chat_bundle: dict,
    messages: list[dict],
) -> None:
    """Move skills not named in earlier assistant answers to the front."""
    facts = chat_bundle.get("facts") or {}
    missing = list(facts.get("missing_skills") or [])
    if not missing:
        return

    previous_answers = "\n".join(
        str(message.get("content") or "").casefold()
        for message in messages
        if isinstance(message, dict) and message.get("role") == "assistant"
    )
    if not previous_answers:
        return

    unseen, mentioned = [], []
    for skill in missing:
        name = str(skill.get("name") or "").strip()
        (mentioned if name and name.casefold() in previous_answers else unseen).append(skill)

    if unseen:
        facts["missing_skills"] = unseen + mentioned


from rest_framework.authentication import TokenAuthentication


@csrf_exempt
def chat_api(request):
    if request.method != "POST":
        return HttpResponseNotAllowed(["POST"])

    try:
        auth_tuple = TokenAuthentication().authenticate(request)
        if auth_tuple:
            request.user = auth_tuple[0]
    except Exception:
        pass

    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, Exception):
        body = {}

    messages = body.get("messages", [])
    if not messages:
        messages = [{"role": "user", "content": "Hello"}]

    profile_data = get_user_profile_sync(request.user)
    if body.get("profile_override") and isinstance(body["profile_override"], dict):
        profile_data = {**profile_data, **body["profile_override"]}

    rag_query = ""
    for m in reversed(messages):
        if m.get("role") == "user" and m.get("content"):
            rag_query = m["content"]
            break

    chat_bundle = build_chat_facts(profile_data, user_query=rag_query)
    suggestion_id = body.get("suggestion_id")
    learning_query = any(
        phrase in rag_query.casefold()
        for phrase in ("czego się uczyć", "czego sie uczyc", "skille warto rozwijać")
    )
    if suggestion_id in {"learning_first", "skills_courses"} or learning_query:
        _prioritize_unmentioned_learning_skills(chat_bundle, messages)

    market_ctx = chat_bundle.get("market_ctx") or {}
    chart_data = chat_bundle.get("chart_data") or {"charts": {}}
    context_block = format_chat_context_block(profile_data, market_ctx)
    facts_json = format_chat_facts_json(chat_bundle)

    rag_context = ""
    if rag_query:
        rag_context = retrieve_context(build_chat_rag_query(rag_query, market_ctx))
    rag_section = f"\n\n{rag_context}" if rag_context else ""

    auto_chart_key = pick_auto_salary_chart(
        rag_query,
        chart_data,
        suggestion_id=suggestion_id,
    )
    chart_note = ""
    salary_style_block = ""
    if auto_chart_key == "salary_by_level_bar":
        salary_style_block = CHAT_SALARY_STYLE_INSTRUCTIONS
        chart_note = (
            "\n\nWykres (auto): serwer na końcu dołączy bar chart — **Twoja odpowiedź to wyłącznie "
            "2–3 akapity płynnej prozy** (patrz CHAT_SALARY_STYLE). Zero bulletów i list z kwotami."
        )
    elif auto_chart_key == "salary_by_pillar_radar":
        salary_style_block = CHAT_SALARY_STYLE_INSTRUCTIONS
        chart_note = (
            "\n\nWykres (auto): serwer na końcu dołączy **dokładnie jeden** wykres radar. "
            "**Twoja odpowiedź to wyłącznie 2–3 akapity płynnej prozy** porównujące branże "
            "(kwoty PLN z facts.salary_by_pillar_radar w zdaniach). "
            "**Zakaz:** obrazków markdown, linków do wykresów, JSON, radarów/wykresów w tekście — "
            "zero duplikatów; ilustracja tylko od serwera."
        )

    system_prompt = {
        "role": "system",
        "content": (
            "You are a personalized AI career advisor for the Polish job market. "
            "Respond in Polish with warm, professional, flowing prose — never dry bullet dumps.\n\n"
            f"User profile (JSON): {json.dumps(profile_data, ensure_ascii=False)}\n\n"
            f"{context_block}\n\n"
            f"## facts (JSON z bazy — jedyne dozwolone liczby)\n"
            f"```json\n{facts_json}\n```\n\n"
            f"{rag_section}\n\n"
            f"{CHAT_DATA_RULES}\n\n"
            f"{CHAT_STYLE_INSTRUCTIONS}\n\n"
            f"{salary_style_block}\n\n"
            f"{CHAT_RAG_INSTRUCTIONS}\n\n"
            "CRITICAL INSTRUCTIONS FOR RAG:\n"
            "1. Market trends, demand outlook, and role comparisons — use 'Dokumenty źródłowe' "
            "and cite report names.\n"
            "2. Salary numbers only from facts/RAG — never invent PLN or %.\n"
            "3. Skills, gaps, segment fit — narrative text from facts.\n"
            "4. Salary charts are appended by the server AFTER your text — write flowing Polish "
            "prose with PLN figures first, then the chart appears below. Never paste JSON, "
            "chart specs, markdown images, or chart URLs.\n\n"
            f"{CHAT_COURSE_INSTRUCTIONS}"
            f"{chart_note}"
        ),
    }
    full_messages = [system_prompt] + list(messages)

    openrouter_key = os.environ.get("OPEN_ROUTER_API_KEY", "")

    def stream_generator():
        if not openrouter_key or openrouter_key == "set_me_up":
            err = "Brak klucza OPEN_ROUTER_API_KEY. Ustaw go w .env i zrestartuj backend."
            yield f'0:{json.dumps(err, ensure_ascii=False)}\n'
            return

        from openai import OpenAI

        client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=openrouter_key,
        )

        tools = []

        pre_rendered_chart = None
        if auto_chart_key:
            try:
                safe_args, guard_err, resolved_tool = apply_chart_guard_for_key(
                    auto_chart_key, chart_data
                )
                if safe_args and not guard_err:
                    if resolved_tool == "generate_radar_chart":
                        mcp_out = render_radar_chart_url(safe_args)
                    else:
                        mcp_out = asyncio.run(
                            _call_mcp_tool(resolved_tool, safe_args)
                        )
                    pre_rendered_chart = _chart_markdown(mcp_out)
            except Exception as exc:
                import logging
                logging.getLogger(__name__).warning("Chart render failed: %s", exc)

        try:
            stream = client.chat.completions.create(
                model=AI_MODEL,
                messages=full_messages,
                stream=True,
                max_tokens=1500,
                temperature=AI_TEMPERATURE,
            )
            response_parts = []
            for chunk in stream:
                if not chunk.choices:
                    continue
                delta = chunk.choices[0].delta
                if delta and delta.content:
                    response_parts.append(delta.content)

            content = "".join(response_parts)
            if auto_chart_key:
                content = _strip_llm_chart_markdown(
                    content,
                    chart_key=auto_chart_key,
                )
            if content:
                yield f'0:{json.dumps(content, ensure_ascii=False)}\n'

            if pre_rendered_chart:
                chart_str = f"\n\n{pre_rendered_chart}\n\n"
                yield f'0:{json.dumps(chart_str, ensure_ascii=False)}\n'

        except Exception as e:
            err = f"Błąd: {str(e)}"
            yield f'0:{json.dumps(err, ensure_ascii=False)}\n'

    response = StreamingHttpResponse(
        stream_generator(),
        content_type="text/plain; charset=utf-8",
    )
    response["Cache-Control"] = "no-cache"
    return response
