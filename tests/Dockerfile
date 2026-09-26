FROM python:3.12-slim
COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt
# Non-root: the nginx-ssl volume also holds the private key (mode 600, root) — keep it unreadable.
RUN useradd -u 1000 -m tester
USER tester
WORKDIR /tests
CMD ["pytest"]
