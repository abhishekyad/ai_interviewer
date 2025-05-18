run the following commands
cd ai_interviewer-main
cd backend
if needed, create a python virtual environment:
python3 -m venv venv
source venv/bin/activate
pip install flask openai flask-cors python-dotenv fastapi uvicorn supabase python-multipart requests axios

now open .env file and paste your SUPABASE credentials and your OPENROUTER API KEY. Save and close.

uvicorn app:app --reload

this will trigger the backend code  on http://127.0.0.1:8000

Now, for frontend:

cd frontend
npm install
npm start
 frontend is running at http://localhost:3000
