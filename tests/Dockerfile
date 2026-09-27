# Pinned together: the image's browsers must match the playwright pip package (requirements.txt).
FROM mcr.microsoft.com/playwright/python:v1.63.0-noble
ENV PIP_BREAK_SYSTEM_PACKAGES=1
COPY requirements.txt /tmp/requirements.txt
RUN python3 -m pip install --no-cache-dir -r /tmp/requirements.txt
# Non-root: the nginx-ssl volume also holds the private key (mode 600, root) — keep it unreadable.
# Ubuntu images already have uid 1000 (`ubuntu`); create it only when missing.
RUN id -u 1000 >/dev/null 2>&1 || useradd -u 1000 -m tester
USER 1000
WORKDIR /tests
CMD ["pytest"]
