FROM python:3.12-slim
COPY requirements.txt /tmp/requirements.txt
RUN python3 -m pip install --no-cache-dir -r /tmp/requirements.txt
# Non-root: the nginx-ssl volume also holds the private key (mode 600, root) — keep it unreadable.
RUN id -u 1000 >/dev/null 2>&1 || useradd -u 1000 -m tester
USER 1000
WORKDIR /tests
CMD ["pytest"]
