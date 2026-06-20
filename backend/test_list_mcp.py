import asyncio

async def test():
    from mcp.client.sse import sse_client
    from mcp.client.session import ClientSession
    async with sse_client("http://mcp-chart:3100/sse") as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            tools = await session.list_tools()
            for t in tools.tools:
                print(f"Tool name: '{t.name}'")

asyncio.run(test())
