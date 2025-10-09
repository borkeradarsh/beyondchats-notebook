# BeyondChats Notebook 📚

A modern, AI-powered document management and chat platform built with Next.js 15. Upload PDFs, organize them in notebooks, and engage in intelligent conversations with your documents using advanced AI.

## ✨ Features

### 📖 Document Management
- **PDF Upload & Processing**: Seamless PDF upload with automatic text extraction
- **Smart Organization**: Create and manage notebooks to categorize your documents
- **Mobile-Responsive Interface**: Optimized experience across all devices
- **Real-time Status Tracking**: Monitor document processing status

### 🤖 AI-Powered Chat
- **Intelligent Document Chat**: Ask questions about your uploaded documents
- **Context-Aware Responses**: AI understands document content and provides relevant answers
- **Multi-Document Support**: Chat across multiple PDFs within a notebook
- **Gemini 2.0 Flash Integration**: Powered by Google's latest AI model

### 🎨 Modern UI/UX
- **Clean, Intuitive Design**: Beautiful interface with smooth animations
- **Success Notifications**: Animated popups for user feedback
- **Responsive Layout**: Perfect experience on desktop, tablet, and mobile
- **Professional Dashboard**: Streamlined user management

### 🚀 Developer Experience
- **Automatic Sample Data**: New users get pre-loaded educational content
- **Production Ready**: Optimized for deployment and scaling
- **Type Safety**: Full TypeScript implementation
- **Modern Stack**: Latest Next.js 15 with App Router

## 🛠️ Tech Stack

- **Frontend**: Next.js 15.3.3, React 18, TypeScript
- **Styling**: Tailwind CSS, Framer Motion for animations
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **PDF Processing**: React-PDF, PDF text extraction
- **AI Integration**: Google Gemini 2.0 Flash API
- **Deployment**: Vercel-ready

## 🔧 AI & Development Tools Used

This project was built with assistance from cutting-edge AI tools:

- **Debugging**: Google Gemini 2.5 Pro for advanced problem-solving
- **Coding**: Claude 4 via GitHub Copilot for intelligent code generation
- **AI Integration**: Google Gemini 2.0 Flash API from Google Studio for document chat functionality

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm/yarn/pnpm
- Supabase account
- Google AI Studio API key

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/borkeradarsh/beyondchats-notebook.git
cd beyondchats-notebook
```

2. **Install dependencies**
```bash
npm install
# or
yarn install
```

3. **Environment Setup**
Create a `.env.local` file:
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Google AI (Gemini 2.0 Flash)
GOOGLE_AI_API_KEY=your_google_ai_api_key
```

4. **Database Setup**
Set up your Supabase database with the required tables:
- `notebooks` - Store notebook information
- `documents` - Store uploaded PDF documents
- `users` - User authentication and profiles

5. **Run Development Server**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## 📱 Key Features Walkthrough

### Document Upload Flow
1. Create a new notebook or select existing one
2. Upload PDF documents with drag-and-drop
3. Watch real-time processing status
4. Receive animated success notification

### Chat Experience
1. Navigate to any notebook with documents
2. Ask questions about your PDFs
3. Get AI-powered responses with context
4. Continue conversation across multiple documents

### Mobile Experience
- Responsive design with optimized mobile navigation
- Touch-friendly interface elements
- Smooth scrolling and animations
- Professional mobile layout

## 🏗️ Project Structure

```
app/
├── dashboard/          # Main dashboard with notebooks
├── notebook/          
│   ├── [id]/          # Individual notebook view with chat
│   └── new/           # Create new notebook
├── lib/               # Utilities and configurations
│   ├── sampleData.ts  # Sample data seeding system
│   └── supabase.ts    # Database configuration
├── globals.css        # Global styles
└── layout.tsx         # Root layout

public/                # Static assets
```

## 🌟 Deployment

### Vercel (Recommended)
1. Connect your GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically on git push

### Manual Deployment
```bash
npm run build
npm start
```

## 📊 Sample Data System

New users automatically receive sample educational content including:
- **KEPH 101 Fundamentals**: Core course materials
- **Study Materials Collection**: Supplementary resources
- **Reference Library**: Additional readings and guides

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built as part of the BeyondChats Full Stack Web Developer assignment
- Powered by Google's Gemini 2.0 Flash AI model
- Enhanced with AI-assisted development tools
- Special thanks to the open-source community

---

**Live Demo**: [Deploy your own](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme)

**Developer**: [Adarsh Borker](https://github.com/borkeradarsh)
