# Anthropic Chat Interface

A Node.js chat application using the Anthropic SDK with tool calling capabilities.

## Features

- Clean, modern chat interface
- Real-time streaming responses (can be toggled on/off)
- Tool calling support:
  - Staff Directory lookup
  - Company Calculator for business calculations
- Conversation history management
- Responsive design

## Prerequisites

- Node.js (v14 or higher)
- An Anthropic API key

## Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory and add your Anthropic API key:
   ```
   ANTHROPIC_API_KEY=your_api_key_here
   ```

## Running the Application

Start the server:
```bash
npm start
```

Or for development with auto-restart:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Usage

1. Open your browser and navigate to `http://localhost:3000`
2. Start chatting with Claude!
3. Toggle streaming on/off using the checkbox in the header
4. Try asking about employees or doing calculations

### Example Queries

- "Who works in the Engineering department?"
- "What is Sarah Chen's contact information?"
- "Calculate 15% of $50,000"
- "What's the ROI if I invest $10,000 and get $15,000 back?"

## Streaming Feature

The application supports real-time streaming of responses:
- **Enabled by default** - See responses appear word-by-word as Claude generates them
- **Toggle on/off** - Use the checkbox in the chat header
- **Tool support** - Streaming works seamlessly with tool calls
- **Visual feedback** - Tool usage is indicated with icons (🔧 for tool use, ✅ for completion)

## Project Structure

- `server.js` - Express server with Anthropic integration and streaming support
- `tools.js` - Tool definitions and implementations
- `public/` - Frontend files
  - `index.html` - Main HTML structure
  - `app.js` - Frontend JavaScript with streaming support
  - `styles.css` - Styling
- `staff-directory.json` - Sample employee data

## Technology Stack

- Node.js
- Express.js
- Anthropic SDK
- Vanilla JavaScript (no frontend frameworks)
- HTML/CSS

## License

MIT

## Note

This is a basic implementation intended for learning purposes. For production use, consider adding:
- Authentication
- Rate limiting
- Error handling
- Conversation persistence
- Improved accessibility 