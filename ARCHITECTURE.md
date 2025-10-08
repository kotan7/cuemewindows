# CueMe Application Architecture Documentation

## Overview

CueMe is an intelligent desktop application built with Electron that provides real-time audio processing, question detection, and AI-powered response generation. The application combines speech recognition, natural language processing, and large language models to assist users in various scenarios like interviews, meetings, sales calls, and support interactions.

## Technology Stack

### Core Technologies
- **Electron**: Desktop application framework
- **React**: Frontend UI framework with TypeScript
- **Node.js**: Backend runtime environment
- **Vite**: Build tool and development server

### AI & ML Services
- **OpenAI**: Speech-to-text (Whisper) and text embeddings
- **Google Gemini**: Large language model for response generation
- **Supabase**: Database and authentication backend

### Key Libraries
- **React Query**: Data fetching and caching
- **Tailwind CSS**: Styling framework
- **Lucide React**: Icon library
- **Radix UI**: UI component primitives

## Application Architecture

### Main Process (Electron Backend)

The main process is orchestrated by the `AppState` class in `main.ts`, which manages:

#### Core Components

1. **AudioStreamProcessor** (`AudioStreamProcessor.ts`)
   - Real-time audio capture and processing
   - Integration with OpenAI Whisper for speech-to-text
   - Question detection and refinement
   - Audio chunk buffering and management

2. **QuestionDetector** (`QuestionDetector.ts`)
   - Pattern-based question detection for Japanese and English
   - Question preprocessing and similarity checking
   - Multi-question splitting and validation

3. **LLMHelper** (`LLMHelper.ts`)
   - Google Gemini integration for AI responses
   - RAG (Retrieval-Augmented Generation) context management
   - Problem extraction from screenshots
   - Mode-aware response generation

4. **ModeManager** (`ModeManager.ts`)
   - Response mode configuration (interview, meeting, sales, etc.)
   - System prompt templating
   - Response structure and formatting rules
   - Tone and formality management

5. **AuthService** (`AuthService.ts`)
   - Supabase authentication integration
   - Session management
   - User state tracking

6. **DocumentService** (`DocumentService.ts`)
   - Document upload and processing
   - Vector embeddings for semantic search
   - RAG context retrieval
   - Document chunk management

7. **QnAService** (`QnAService.ts`)
   - Q&A collection management
   - Semantic search across Q&A items
   - Context formatting for RAG

#### Helper Classes

- **WindowHelper** (`WindowHelper.ts`): Window management and positioning
- **ScreenshotHelper** (`ScreenshotHelper.ts`): Screen capture functionality
- **ProcessingHelper** (`ProcessingHelper.ts`): Coordinates LLM processing workflows
- **UsageTracker** (`UsageTracker.ts`): API usage monitoring and limits

### Renderer Process (React Frontend)

#### Main Application Structure

1. **App.tsx**: Root component with routing and global state
2. **Queue.tsx**: Main interface for screenshot queue and audio processing
3. **Solutions.tsx**: Display area for AI-generated solutions
4. **Debug.tsx**: Development and debugging interface

#### Key Components

1. **QuestionSidePanel**: Real-time question display and interaction
2. **ScreenshotQueue**: Visual queue of captured screenshots
3. **AuthDialog**: User authentication interface
4. **ModeSelect**: Response mode selection UI

#### Type Definitions

- **audio-stream.ts**: Audio processing and question detection types
- **modes.ts**: Response mode configuration types
- **solutions.ts**: Problem and solution data structures
- **electron.d.ts**: Electron API type definitions

## Data Flow

### Audio Processing Pipeline

1. **Audio Capture**: Real-time audio stream from microphone
2. **Chunk Processing**: Audio divided into processable chunks
3. **Speech Recognition**: OpenAI Whisper converts audio to text
4. **Question Detection**: Pattern matching identifies questions
5. **Question Refinement**: LLM improves question clarity
6. **Context Retrieval**: RAG system finds relevant information
7. **Response Generation**: Gemini generates mode-appropriate responses

### Screenshot Processing Pipeline

1. **Screen Capture**: Automated or manual screenshot capture
2. **Problem Extraction**: LLM analyzes images for problems
3. **Solution Generation**: AI creates step-by-step solutions
4. **Complexity Analysis**: Time/space complexity calculation
5. **Code Generation**: Formatted code solutions with syntax highlighting

### Authentication Flow

1. **User Login**: Supabase authentication
2. **Session Management**: Persistent login state
3. **API Access**: Authenticated requests to services
4. **Usage Tracking**: Monitor API consumption

## Configuration System

### Response Modes

The application supports multiple response modes, each with specific characteristics:

- **Interview Mode**: Concise, confident responses for technical interviews
- **Meeting Mode**: Structured, professional communication
- **Sales Mode**: Persuasive, value-focused messaging
- **Telesales Mode**: Brief, engaging phone conversation style
- **Support Mode**: Helpful, step-by-step assistance

### Mode Configuration Parameters

- **Tone**: assertive, neutral, sales, support
- **Formality**: keigo, desu_masu, casual
- **Length**: short, standard, long
- **Structure**: conclusion_first, steps, prep, etc.
- **Content Limits**: sentence count, bullet points, examples

## Security Considerations

### API Key Management
- Environment variables for sensitive credentials
- Graceful degradation when keys are missing
- Secure storage of authentication tokens

### Data Privacy
- Local audio processing where possible
- Encrypted communication with external services
- User consent for data processing

## Development Setup

### Prerequisites
- Node.js 18+
- npm or yarn package manager
- Required API keys (OpenAI, Gemini, Supabase)

### Environment Variables
```bash
OPENAI_API_KEY=your_openai_key
GEMINI_API_KEY=your_gemini_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Build Process
1. Install dependencies: `npm install`
2. Development mode: `npm run dev`
3. Build application: `npm run build`
4. Package for distribution: `npm run dist`

## Performance Optimizations

### Audio Processing
- Efficient audio chunking and buffering
- Debounced question detection
- Optimized transcription batching

### UI Responsiveness
- React Query for efficient data caching
- Virtualized lists for large datasets
- Lazy loading of components

### Memory Management
- Proper cleanup of audio streams
- Event listener management
- Resource disposal in Electron processes

## Future Enhancements

### Planned Features
- Multi-language support expansion
- Advanced audio filtering
- Custom mode creation
- Offline processing capabilities
- Enhanced RAG with multiple document types

### Technical Improvements
- WebRTC for better audio quality
- Local LLM integration options
- Advanced caching strategies
- Performance monitoring and analytics

## Troubleshooting

### Common Issues
1. **Audio not detected**: Check microphone permissions
2. **API errors**: Verify environment variables and API keys
3. **Authentication failures**: Check Supabase configuration
4. **Performance issues**: Monitor memory usage and API rate limits

### Debug Mode
The application includes a debug interface accessible through the Debug.tsx component for development and troubleshooting.

## Contributing

When contributing to the codebase:
1. Follow TypeScript best practices
2. Maintain consistent code formatting
3. Add appropriate error handling
4. Update documentation for new features
5. Test across different operating systems

This architecture provides a robust foundation for an AI-powered desktop assistant while maintaining modularity and extensibility for future enhancements.