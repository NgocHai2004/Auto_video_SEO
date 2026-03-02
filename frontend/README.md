# Frontend - Video Pipeline UI

React-based frontend for the video generation pipeline.

## Tech Stack

- React 18 + TypeScript
- Vite
- TailwindCSS
- React Flow (pipeline visualization)

## Features

- Visual pipeline editor
- Batch processing interface
- Real-time progress tracking via SSE
- Jobs dashboard
- Audio/Video preview

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Docker

```bash
docker build -t pipeline-frontend .
docker run -p 80:80 pipeline-frontend
```

## Environment Variables

Configure API endpoint in `src/api/client.ts` or via environment:

```env
VITE_API_URL=http://localhost:8000
```

## Project Structure

```
frontend/
├── src/
│   ├── api/          # API client modules
│   ├── components/   # React components
│   │   ├── batch/    # Batch processing components
│   │   ├── canvas/   # Pipeline canvas components
│   │   ├── config/   # Configuration drawers
│   │   ├── jobs/     # Jobs dashboard components
│   │   ├── layout/   # Layout components
│   │   ├── pipeline/ # Pipeline components
│   │   ├── results/  # Result display components
│   │   └── shared/   # Shared/reusable components
│   ├── hooks/        # Custom React hooks
│   ├── pages/        # Page components
│   ├── types/        # TypeScript types
│   └── utils/        # Utility functions
├── public/           # Static assets
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```
