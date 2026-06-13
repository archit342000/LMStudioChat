from flask import Flask
from router import models_bp

app = Flask(__name__)
app.register_blueprint(models_bp, url_prefix='/api/models')

if __name__ == '__main__':
    # Listen on port 5001 for proxy traffic
    app.run(host='0.0.0.0', port=5001, debug=True)
