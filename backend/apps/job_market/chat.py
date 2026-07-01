import asyncio
import json
import os

from django.http import StreamingHttpResponse, HttpResponseNotAllowed
from django.views.decorators.csrf import csrf_exempt
from mcp.client.stdio import stdio_client, StdioServerParameters
from mcp.client.session import ClientSession

from apps.job_market.services.career_chat_context import (
    CHAT_COURSE_INSTRUCTIONS,
    build_chat_career_context,
    format_chat_context_block,
)
from apps.job_market.services.rag_service import retrieve_context

SERVER_PARAMS = StdioServerParameters(
    command="mcp-server-chart",
    args=[]
)

AI_MODEL = "openai/gpt-4o-mini"

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

    market_ctx = build_chat_career_context(profile_data)
    context_block = format_chat_context_block(profile_data, market_ctx)

    # ── RAG: retrieve grounding context from indexed market reports ────────────
    # Use the last user message as the retrieval query for best relevance.
    rag_query = ""
    for m in reversed(messages):
        if m.get("role") == "user" and m.get("content"):
            rag_query = m["content"]
            break

    rag_context = retrieve_context(rag_query) if rag_query else ""
    rag_section = f"\n\n{rag_context}" if rag_context else ""
    import sys
    print(f"RAG Query: {rag_query!r}", file=sys.stderr)
    print(f"RAG Section length: {len(rag_section)}", file=sys.stderr)
    # ──────────────────────────────────────────────────────────────────────────

    system_prompt = {
        "role": "system",
        "content": (
            "You are a personalized AI career advisor for the Polish job market. "
            "Respond in Polish. Be concise, practical, and encouraging.\n\n"
            f"User profile (JSON): {json.dumps(profile_data, ensure_ascii=False)}\n\n"
            f"{context_block}\n\n"
            f"{rag_section}\n\n"
            "CRITICAL INSTRUCTIONS FOR RAG:\n"
            "1. When answering questions about the job market, salaries, or trends, YOU MUST BASE YOUR ANSWER ENTIRELY ON THE 'Dokumenty źródłowe' provided above.\n"
            "2. DO NOT hallucinate or make up salary bands (e.g. Junior/Mid) if they are not explicitly present in the provided reports.\n"
            "3. If the reports only mention 'Senior', state clearly that you only have data for Senior roles.\n"
            "4. Always cite the specific report name (e.g., 'Według raportu Antal...').\n\n"
            f"{CHAT_COURSE_INSTRUCTIONS}\n\n"
            "Use the profile and market context whenever the user asks about themselves, "
            "skills, career path, courses, or trends. "
            "When the user asks for a chart, use available chart tools and embed results as Markdown images."
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
        try:
            tools = asyncio.run(_fetch_mcp_tools())
        except Exception:
            # Silently proceed without tools if MCP fails
            pass

        try:
            first_call_kwargs = {
                "model": AI_MODEL,
                "messages": full_messages,
                "max_tokens": 1500,
                "temperature": AI_TEMPERATURE,
            }
            if tools:
                first_call_kwargs["tools"] = tools

            response = client.chat.completions.create(**first_call_kwargs)
            msg = response.choices[0].message

            if msg.tool_calls:
                tool_results = []
                charts_to_yield = []
                for tc in msg.tool_calls:
                    try:
                        args = json.loads(tc.function.arguments)
                        result_text = asyncio.run(
                            _call_mcp_tool(tc.function.name, args)
                        )
                        if result_text.startswith("!["):
                            charts_to_yield.append(result_text)
                            result_text = "[Chart rendered successfully. User can see the chart now. Provide a brief comment.]"
                    except Exception as e:
                        result_text = f"Tool error: {e}"
                    tool_results.append((tc.id, tc.function.name, result_text))

                tool_messages = list(full_messages) + [
                    {
                        "role": "assistant",
                        "content": msg.content,
                        "tool_calls": [
                            {
                                "id": tc.id,
                                "type": "function",
                                "function": {
                                    "name": tc.function.name,
                                    "arguments": tc.function.arguments,
                                },
                            }
                            for tc in msg.tool_calls
                        ],
                    }
                ]
                for tc_id, tc_name, content in tool_results:
                    tool_messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": tc_id,
                            "name": tc_name,
                            "content": content,
                        }
                    )

                for chart in charts_to_yield:
                    chart_str = chart + "\n\n"
                    yield f'0:{json.dumps(chart_str, ensure_ascii=False)}\n'

                stream = client.chat.completions.create(
                    model=AI_MODEL,
                    messages=tool_messages,
                    stream=True,
                    max_tokens=1500,
                    temperature=AI_TEMPERATURE,
                )
                for chunk in stream:
                    if not chunk.choices:
                        continue
                    delta = chunk.choices[0].delta
                    if delta and delta.content:
                        yield f'0:{json.dumps(delta.content, ensure_ascii=False)}\n'

            else:
                stream = client.chat.completions.create(
                    model=AI_MODEL,
                    messages=full_messages,
                    stream=True,
                    max_tokens=1500,
                    temperature=AI_TEMPERATURE,
                )
                for chunk in stream:
                    if not chunk.choices:
                        continue
                    delta = chunk.choices[0].delta
                    if delta and delta.content:
                        yield f'0:{json.dumps(delta.content, ensure_ascii=False)}\n'

        except Exception as e:
            err = f"Błąd: {str(e)}"
            yield f'0:{json.dumps(err, ensure_ascii=False)}\n'

    response = StreamingHttpResponse(
        stream_generator(),
        content_type="text/plain; charset=utf-8",
    )
    response["Cache-Control"] = "no-cache"
    return response
