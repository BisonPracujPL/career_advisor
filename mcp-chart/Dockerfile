FROM node:20-slim
WORKDIR /app

# supergateway bridges stdio MCP servers to HTTP/SSE
RUN npm install -g supergateway

EXPOSE 3100

CMD ["supergateway", \
     "--stdio", "npx -y @antv/mcp-server-chart", \
     "--port", "3100", \
     "--baseUrl", "http://mcp-chart:3100", \
     "--cors"]
