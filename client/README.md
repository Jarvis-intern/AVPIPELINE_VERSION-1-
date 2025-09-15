# EML Converter

A web application for converting EML files to HTML with attachments handling.

## Project Status

This project is in an early development phase. Currently, it includes:

- A React frontend UI with placeholder components
- A minimal Flask backend server for future API implementation

The actual EML conversion functionality will be implemented in a later phase.

## Project Structure

```
/
├── src/                # Frontend React code
│   ├── components/     # React components
│   ├── hooks/          # React hooks
│   ├── lib/            # Utility functions
│   └── main.tsx        # Main entry point
└── backend/            # Flask backend
    ├── app.py          # Main Flask application
    ├── uploads/        # Future upload directory
    ├── output/         # Future output directory
    └── requirements.txt # Python dependencies
```

## Setup and Running

### Frontend

1. Install dependencies:
```
npm install
```

2. Start the development server:
```
npm run dev
```

The frontend will be available at http://localhost:5173.

### Backend

1. Create a virtual environment:
```
cd backend
python -m venv venv
```

2. Activate the virtual environment:
- Windows: `venv\Scripts\activate`
- Unix/MacOS: `source venv/bin/activate`

3. Install dependencies:
```
pip install -r requirements.txt
```

4. Run the server:
```
python app.py
```

The backend will be available at http://localhost:5000.

## Configuration

You can configure the API URL by creating a `.env.local` file in the project root:

```
VITE_API_URL=http://your-api-server:5000/api
``` 