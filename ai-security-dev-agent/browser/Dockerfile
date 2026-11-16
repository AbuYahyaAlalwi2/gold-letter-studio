FROM mcr.microsoft.com/playwright:v1.49.1-jammy
WORKDIR /app
RUN npm install -g @playwright/mcp
EXPOSE 8931
CMD ["npx", "@playwright/mcp", "--host", "0.0.0.0", "--port", "8931"]
