// Stage and Scene data types
import type { Slide } from '@/lib/types/slides';
import type { Action } from '@/lib/types/action';

// 场景类型：幻灯片、交互式、商业报告
export type SceneType = 'slide' | 'interactive' | 'report';

export type StageMode = 'autonomous' | 'playback';

export type Whiteboard = Omit<Slide, 'theme' | 'turningMode' | 'sectionTag' | 'type'>;

/**
 * Stage - Represents the entire analysis report/project
 */
export interface Stage {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  // Stage metadata
  language?: string;
  style?: string;
  // Whiteboard data
  whiteboard?: Whiteboard[];
  // Agent IDs selected when this project was created
  agentIds?: string[];
  /**
   * Server-generated agent configurations.
   * Embedded in persisted project JSON so clients can hydrate
   * the agent registry without relying on IndexedDB pre-population.
   * Only present for API-generated projects.
   */
  generatedAgentConfigs?: Array<{
    id: string;
    name: string;
    role: string;
    persona: string;
    avatar: string;
    color: string;
    priority: number;
  }>;
}

/**
 * Scene - Represents a single page/scene in the report
 */
export interface Scene {
  id: string;
  stageId: string; // ID of the parent stage (for data integrity checks)
  type: SceneType;
  title: string;
  order: number; // Display order

  // Type-specific content
  content: SceneContent;

  // Actions to execute during playback
  actions?: Action[];

  // Whiteboards to explain deeply
  whiteboards?: Slide[];

  // Multi-agent discussion configuration
  multiAgent?: {
    enabled: boolean; // Enable multi-agent for this scene
    agentIds: string[]; // Which agents to include (from registry)
    directorPrompt?: string; // Optional custom director instructions
  };

  // Metadata
  createdAt?: number;
  updatedAt?: number;
}

/**
 * Scene content based on type
 */
export type SceneContent = SlideContent | InteractiveContent | ReportContent;

/**
 * Slide content - PPTist Canvas data
 */
export interface SlideContent {
  type: 'slide';
  // PPTist slide data structure
  canvas: Slide;
}

/**
 * Interactive content - Interactive web page (iframe)
 */
export interface InteractiveContent {
  type: 'interactive';
  url: string; // URL of the interactive page
  // Optional: embedded HTML content
  html?: string;
}

/**
 * Report content - Business analysis report
 */
export interface ReportContent {
  type: 'report';
  reportType: 'market' | 'competitive' | 'financial' | 'strategic';
  sections: ReportSection[];
  executiveSummary?: string;
  data?: Record<string, unknown>;
}

/**
 * Report section structure
 */
export interface ReportSection {
  id: string;
  title: string;
  content: string;
  charts?: ReportChart[];
}

/**
 * Chart data for report sections
 */
export interface ReportChart {
  id: string;
  chartType: 'bar' | 'line' | 'pie' | 'radar' | 'scatter';
  title: string;
  data: {
    labels: string[];
    series: Array<{
      name: string;
      values: number[];
    }>;
  };
}

// Re-export generation types for convenience
export type {
  UserRequirements,
  SceneOutline,
  GenerationSession,
  GenerationProgress,
  UploadedDocument,
} from './generation';
