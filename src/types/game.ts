export type ActiveTab = 'prototypes' | 'stack-guide' | 'stack-quiz' | 'idea-generator' | 'shader-lab';

export type GamePrototypeId = 'runner' | 'marble' | 'arena';

export interface GameIdea {
  id: string;
  title: string;
  tagline: string;
  genre: string;
  artStyle: string;
  camera: string;
  coreHook: string;
  coreLoop: string;
  targetAudience: string;
  scopeDifficulty: 'Iniciante' | 'Intermediário' | 'Avançado';
  recommendedStack: string;
  mvpFeatures: string[];
  controls: string[];
  assetNeeds: string[];
}

export interface EngineComparison {
  id: string;
  name: string;
  category: 'Web 3D' | 'Desktop/Mobile' | 'AAA Engine' | 'Systems/Code';
  idealFor: string;
  languages: string[];
  renderers: string[];
  pros: string[];
  cons: string[];
  licensing: string;
  marketShare: string;
  bestGamesExamples: string[];
  starterBoilerplateCode: string;
}

export interface QuizAnswers {
  experience: string;
  platform: string;
  artStyle: string;
  genre: string;
  teamSize: string;
}

export interface QuizResult {
  engine: string;
  title: string;
  matchScore: number;
  whyThisChoice: string;
  recommendedLanguages: string[];
  toolsPipeline: {
    modeling: string;
    physics: string;
    audio: string;
    hostingOrStore: string;
  };
  architectureSteps: string[];
  starterCodeSample: string;
  thirtyDayRoadmap: { week: string; task: string }[];
}
