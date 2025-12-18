# Interactive Web-Based Terminal

An interactive terminal that runs in the browser using WebSockets, built with Node.js and xterm.js.

## Features
- Real-time terminal interaction via WebSockets.
- Supports full terminal interactivity (e.g., Vim, Nano).
- Options for shared or individual terminal sessions.

## Requirements
- Node.js - v16 or higher.
- NPM

## Setup Process

The project consists of two parts, the **backend** (Node.js server) and the **frontend** (xterm.js terminal interface), just like a typical web application.

### Project Setup

1. Clone this repository:
   ```bash
   git clone https://github.com/alexandre2004costa/IAS_AI_liar
   ```

2. Navigate to the project directory:
   ```bash
   cd interactive-terminal
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

   ```bash
   npm install openai
   ```

   ```bash
   npm install uuid
   ```

   ```bash
   npm install dotenv
   ```

4. Start the server:
   ```bash
   npm run start
   ```

5. The demo runs on port `6060` by default. You can modify this by editing the port number in the configuration section of the `/src/server.js` file.

### Frontend
The frontend automatically loads in your browser at `http://localhost:6060` when the server starts. The client-side code is located in `/src/client.js`.

## Customization

- **Port Configuration**: To change the default port, update the port number in the `/src/server.js` file.
