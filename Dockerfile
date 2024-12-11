FROM python:3.12-alpine

WORKDIR /usr/src/app

COPY . .

RUN	apk add --no-cache git && \
ln -s /root /app && \
pip install --no-cache-dir -r requirements.txt && \

CMD [ "python", "g-server.py" ]
