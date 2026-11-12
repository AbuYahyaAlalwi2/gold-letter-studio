FROM node:24.9.0-bookworm-slim
ENV CI=true DSH_HOME=/data/dsh
RUN npm install --global @deepseek-ai/dsh@0.2.2-rc.2 && npm cache clean --force
WORKDIR /workspace
COPY entrypoint.sh /usr/local/bin/dsh-entrypoint
COPY model-gateway.patch.yml /opt/dsh/model-gateway.patch.yml
RUN chmod 0555 /usr/local/bin/dsh-entrypoint
EXPOSE 3080
ENTRYPOINT ["/usr/local/bin/dsh-entrypoint"]
