FROM python:3.12

WORKDIR /usr/src/app

COPY requirements.txt .

RUN python -m venv /py && \
    /py/bin/pip install --upgrade pip && \

pip install --no-cache-dir -r requirements.txt && \

CMD [ "python", "g-server.py" ]
