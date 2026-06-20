import asyncio
import json

async def test():
    from mcp.client.stdio import stdio_client, ServerParameters
    from mcp.client.session import ClientSession
    SERVER_PARAMS = ServerParameters(command="npx", args=["-y", "@antv/mcp-server-chart"])
    
    async with stdio_client(SERVER_PARAMS) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            try:
                args = {
                    "chartType": "pie",
                    "data": [
                        {"language": "Python", "value": 70},
                        {"language": "R", "value": 20},
                        {"language": "SQL", "value": 10}
                    ],
                    "config": {
                        "angleField": "value",
                        "colorField": "language"
                    }
                }
                result = await session.call_tool("generate_pie_chart", arguments=args)
                print("SUCCESS:", len(result.content[0].text))
            except Exception as e:
                print("ERROR:", str(e))

asyncio.run(test())
