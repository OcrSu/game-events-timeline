FROM python:3.12

pip install --no-cache-dir -r requirements.txt && \

CMD [ "python", "g-server.py" ]
