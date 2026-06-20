import asyncio
import json
import os

from django.http import StreamingHttpResponse, HttpResponseNotAllowed
from django.views.decorators.csrf import csrf_exempt
from mcp.client.stdio import stdio_client, StdioServerParameters
from mcp.client.session import ClientSession

SERVER_PARAMS = StdioServerParameters(
    command="mcp-server-chart",
    args=[]
)

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

    system_prompt = {
        "role": "system",
        "content": (
            "You are a personalized AI career advisor. Respond in Polish. "
            "Be concise, practical, and encouraging. "
            f"Here is the detailed user profile data (in JSON format): {json.dumps(profile_data, ensure_ascii=False)}. "
            "You must use this profile information whenever the user asks about themselves, their background, skills, or what you know about them. "
            "Give specific, actionable career advice based on their profile. "
            "Use markdown for structure (bullet points, bold text). "
            "When the user asks for a chart or visualization, use the available chart tools. "
            "After generating a chart, embed the result as a Markdown image so it displays inline."
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
        except Exception as e:
            # Silently proceed without tools if MCP fails
            pass

        try:
            first_call_kwargs = {
                "model": "openai/gpt-4o-mini",
                "messages": full_messages,
                "max_tokens": 1500,
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
                    model="openai/gpt-4o-mini",
                    messages=tool_messages,
                    stream=True,
                    max_tokens=1500,
                )
                for chunk in stream:
                    if not chunk.choices:
                        continue
                    delta = chunk.choices[0].delta
                    if delta and delta.content:
                        yield f'0:{json.dumps(delta.content, ensure_ascii=False)}\n'

            else:
                stream = client.chat.completions.create(
                    model="openai/gpt-4o-mini",
                    messages=full_messages,
                    stream=True,
                    max_tokens=1500,
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
