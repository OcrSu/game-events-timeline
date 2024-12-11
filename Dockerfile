FROM python:3.12-alpine

WORKDIR /usr/src/app

COPY . .

ln -s /root /app && \
pip install --no-cache-dir -r requirements.txt && \
rm -rf /var/cache/apk/

CMD [ "python", "g-server.py" ]
