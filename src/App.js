import { useState } from 'react';
import axios from 'axios';

function App() {
  const [input, setInput] = useState('');
  const [chat, setChat] = useState([]);
  const [resumeFile, setResumeFile] = useState(null);
  const [jdFile, setJdFile] = useState(null);
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [liveTranscript, setLiveTranscript] = useState('');

  const speakText = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    speechSynthesis.speak(utterance);
  };

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech Recognition not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          setInput(result[0].transcript);
          // Keep liveTranscript until send is clicked, so do NOT clear here
        } else {
          interimTranscript += result[0].transcript;
        }
      }
      setLiveTranscript(interimTranscript);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
    };

    recognition.start();
  };

  const uploadFiles = async () => {
    if (!resumeFile || !jdFile) {
      alert('Please upload both resume and job description.');
      return;
    }

    const formData = new FormData();
    formData.append('resume', resumeFile);
    formData.append('job_description', jdFile);

    try {
      const response = await axios.post('http://127.0.0.1:5000/upload', formData);
      if (response.data.success) {
        setInterviewStarted(true);
        const aiStart = await axios.post('http://127.0.0.1:5000/start_interview');
        setChat([{ role: 'assistant', content: aiStart.data.question }]);
        speakText(aiStart.data.question);
      } else {
        alert('Failed to upload documents. Please try again.');
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Error uploading files.');
    }
  };

  const sendMessage = async () => {
    // Use liveTranscript if it has content, else fallback to input field
    const messageToSend = liveTranscript.trim() || input.trim();
    if (!messageToSend) return;

    const updatedChat = [...chat, { role: 'user', content: messageToSend }];
    setChat(updatedChat);

    // Clear input and live transcript after sending
    setInput('');
    setLiveTranscript('');

    try {
      const response = await axios.post('http://127.0.0.1:5000/interview', {
        question: messageToSend,
        history: updatedChat,
      });
      const reply = response.data.reply;
      setChat((prev) => [...prev, { role: 'assistant', content: reply }]);
      speakText(reply);
    } catch (error) {
      console.error('Error during interview:', error);
      alert('Error sending message.');
    }
  };

  const endInterview = async () => {
    try {
      const response = await axios.post('http://127.0.0.1:5000/end_interview', {
        history: chat,
      });
      setFeedback(response.data.feedback);
    } catch (error) {
      console.error('Error ending interview:', error);
      alert('Error ending interview.');
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto font-sans bg-gray-50 min-h-screen flex gap-6">
      {/* Main content */}
      <div className="flex-1 space-y-6">
        <h1 className="text-3xl font-bold text-center text-blue-700">🎤 AI Interviewer</h1>

        {!interviewStarted ? (
          <div className="bg-white shadow-lg rounded-lg p-6 border max-w-xl mx-auto">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Upload Documents</h2>
            <div className="space-y-4">
              <div>
                <label className="block font-medium text-gray-700 mb-1">Upload Resume</label>
                <input
                  type="file"
                  accept=".pdf,.docx"
                  onChange={(e) => setResumeFile(e.target.files[0])}
                  className="w-full border p-2 rounded"
                />
              </div>
              <div>
                <label className="block font-medium text-gray-700 mb-1">Upload Job Description</label>
                <input
                  type="file"
                  accept=".pdf,.docx"
                  onChange={(e) => setJdFile(e.target.files[0])}
                  className="w-full border p-2 rounded"
                />
              </div>
              <button
                onClick={uploadFiles}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
              >
                🚀 Start Interview
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-white shadow rounded-lg p-4 border max-w-3xl mx-auto">
              <h2 className="text-lg font-semibold mb-2 text-gray-800">Interview Chat</h2>
              <div className="h-80 overflow-y-auto space-y-2">
                {chat.map((msg, i) => (
                  <div
                    key={i}
                    className={`p-2 rounded ${
                      msg.role === 'user' ? 'bg-blue-50 text-right' : 'bg-gray-100 text-left'
                    }`}
                  >
                    <p>
                      <strong>{msg.role === 'user' ? 'You' : 'AI'}:</strong> {msg.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 max-w-3xl mx-auto w-full">
              <input
                className="border p-3  rounded-lg shadow-sm w-full h-16"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type or speak your answer..."
              />
              <button
                onClick={startListening}
                className="bg-indigo-500 text-white px-4 py-2 rounded-lg hover:bg-indigo-600 transition"
                title="Start voice input"
              >
                🎤
              </button>
              <button
                onClick={sendMessage}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
              >
                Send
              </button>
            </div>

            <button
              onClick={endInterview}
              className="mt-4 bg-red-500 text-white px-6 py-2 rounded-lg hover:bg-red-600 transition max-w-3xl mx-auto block"
            >
              ⛔ End Interview
            </button>
          </>
        )}

        {feedback && (
          <div className="bg-white shadow rounded-lg p-4 border mt-4 max-w-3xl mx-auto">
            <h2 className="text-lg font-semibold mb-2 text-green-700">📋 Interview Feedback</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{feedback}</p>
          </div>
        )}
      </div>

      {/* Live Transcript Panel */}
      {interviewStarted && (
        <div className="w-80 bg-yellow-50 border border-yellow-300 p-4 rounded-lg shadow-sm sticky top-6 h-[80vh] overflow-y-auto">
          <h3 className="font-semibold mb-2 text-yellow-800">🎙 Live Transcript</h3>
          <p className="whitespace-pre-wrap text-gray-800 min-h-[4rem]">
            {liveTranscript || 'Waiting for speech...'}
          </p>
        </div>
      )}
    </div>
  );
}

export default App;
