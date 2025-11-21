from flask import Flask

app = Flask(__name__)

@app.route("/", methods=["GET"])
def home():
    return "Flask Backend for TNEA College Predictor is running on Vercel!"
