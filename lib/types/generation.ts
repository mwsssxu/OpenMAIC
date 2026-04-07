/**
 * Generation Types - Two-Stage Content Generation System
 *
 * Stage 1: User requirements + documents → Scene Outlines (per-page)
 * Stage 2: Scene Outlines → Full Scenes (slide/interactive/report with actions)
 */

import type { ActionType } from './action';
import type { MediaGenerationRequest } from '@/lib/media/types';

// ==================== PDF Image Types ====================

/**
 * Image extracted from PDF with metadata
 */
export interface PdfImage {
  id: string; // e.g., "img_1", "img_2"
  src: string; // base64 data URL (empty when stored in IndexedDB)
  pageNumber: number; // Page number in PDF
  description?: string; // Optional description for AI context
  storageId?: string; // Reference to IndexedDB (session_xxx_img_1)
  width?: number; // Image width (px or normalized)
  height?: number; // Image height (px or normalized)
}

/**
 * Image mapping for post-processing: image_id → base64 URL
 */
export type ImageMapping = Record<string, string>;

// ==================== Stage 1 Input ====================

export interface AudienceProfile {
  gradeLevel: string; // "K-12", "University", "Professional"
  ageRange?: string; // "6-12", "18-25"
  prerequisites?: string[]; // Required prior knowledge
  learningStyles?: ('visual' | 'auditory' | 'kinesthetic' | 'reading')[];
}

export interface StylePreferences {
  tone: 'formal' | 'casual' | 'engaging' | 'academic';
  visualStyle: 'minimalist' | 'colorful' | 'professional' | 'playful';
  interactivityLevel: 'low' | 'medium' | 'high';
  includeExamples: boolean;
  includePractice: boolean;
  language: string; // 'zh-CN', 'en-US'
}

export interface UploadedDocument {
  id: string;
  name: string; // Original filename
  type: 'pdf' | 'docx' | 'pptx' | 'txt' | 'md' | 'image' | 'other';
  size: number; // Bytes
  uploadedAt: Date;
  contentSummary?: string; // Placeholder for parsing
  extractedTopics?: string[]; // Placeholder for parsing
  pageCount?: number;
  storageRef?: string;
}

/**
 * Strategic context for business analysis
 * Collects comprehensive user situation for informed decision-making
 */
export interface StrategicContext {
  // ── Decision Context ──
  /** What decision needs to be made? */
  decisionQuestion?: string;
  /** Decision timeline (e.g., "Q2 2024", "Within 2 weeks") */
  timeline?: string;
  /** Decision urgency: low/medium/high/critical */
  urgency?: 'low' | 'medium' | 'high' | 'critical';
  
  // ── Organization Profile ──
  /** Company/organization name */
  organizationName?: string;
  /** Industry sector */
  industry?: string;
  /** Company size: startup/sme/enterprise */
  companySize?: 'startup' | 'sme' | 'enterprise';
  /** Annual revenue range (for context) */
  revenueRange?: string;
  /** Geographic market focus */
  markets?: string[];
  
  // ── Stakeholders ──
  /** Who will use this analysis? */
  targetAudience?: string[];
  /** Key decision makers */
  decisionMakers?: string[];
  
  // ── Constraints & Priorities ──
  /** Budget constraints */
  budgetConstraints?: string;
  /** Resource constraints (team, technology, time) */
  resourceConstraints?: string[];
  /** Risk tolerance: conservative/moderate/aggressive */
  riskTolerance?: 'conservative' | 'moderate' | 'aggressive';
  /** Top 3 priorities ranked */
  priorities?: string[];
  
  // ── Available Data ──
  /** What data/sources are already available? */
  availableData?: string[];
  /** What data gaps exist? */
  dataGaps?: string[];
  /** Competitor information available */
  competitorInfo?: string[];
  
  // ── Background & History ──
  /** Previous decisions or context */
  previousDecisions?: string;
  /** Current challenges */
  challenges?: string[];
  /** Success criteria */
  successCriteria?: string[];
}

/**
 * Simplified user requirements for strategic analysis generation
 * Supports both free-form input and structured strategic context
 */
export interface UserRequirements {
  requirement: string; // Single free-form text for all user input
  language: 'zh-CN' | 'en-US'; // Report language - critical for generation
  userNickname?: string; // User nickname for personalization
  userBio?: string; // User background for personalization
  webSearch?: boolean; // Enable web search for richer context
  
  // Strategic context for informed analysis
  strategicContext?: StrategicContext;
}

/**
 * @deprecated Use UserRequirements instead
 * Legacy structured requirements - kept for backward compatibility
 */
export interface LegacyUserRequirements {
  topic: string;
  description?: string;
  learningObjectives: string[];
  audience: AudienceProfile;
  durationMinutes: number;
  style: StylePreferences;
  documents?: UploadedDocument[];
  additionalNotes?: string;
}

// ==================== Stage 1 Output: Scene Outlines (Simplified) ====================

/**
 * Simplified scene outline
 * Gives AI more freedom, only requiring intent description and key points
 */
export interface SceneOutline {
  id: string;
  type: 'slide' | 'interactive' | 'report';
  title: string;
  description: string; // 1-2 sentences describing the purpose
  keyPoints: string[]; // 3-5 core key points
  estimatedDuration?: number; // seconds
  order: number;
  language?: 'zh-CN' | 'en-US'; // Generation language (inherited from requirements)
  // Suggested image IDs (from PDF-extracted images)
  suggestedImageIds?: string[]; // e.g., ["img_1", "img_3"]
  // AI-generated media requests (when PDF images are insufficient)
  mediaGenerations?: MediaGenerationRequest[]; // e.g., [{ type: 'image', prompt: '...', elementId: 'gen_img_1' }]
  // Interactive-specific config
  interactiveConfig?: {
    conceptName: string;
    conceptOverview: string;
    designIdea: string;
    subject?: string;
  };
  // Report-specific config
  reportConfig?: {
    reportType: 'market' | 'competitive' | 'financial' | 'strategic';
    targetAudience: string;
    dataSources?: string[];
    includeExecutiveSummary?: boolean;
  };
}

// ==================== Stage 3 Output: Generated Content ====================

import type { PPTElement, SlideBackground } from './slides';
import type { ReportSection, ReportChart } from './stage';

/**
 * AI-generated slide content
 */
export interface GeneratedSlideContent {
  elements: PPTElement[];
  background?: SlideBackground;
  remark?: string;
}

// ==================== Interactive Generation Types ====================

/**
 * Scientific model output from scientific modeling stage
 */
export interface ScientificModel {
  core_formulas: string[];
  mechanism: string[];
  constraints: string[];
  forbidden_errors: string[];
}

/**
 * AI-generated interactive content
 */
export interface GeneratedInteractiveContent {
  html: string;
  scientificModel?: ScientificModel;
}

// ==================== Report Generation Types ====================

/**
 * AI-generated report content
 */
export interface GeneratedReportContent {
  reportType: 'market' | 'competitive' | 'financial' | 'strategic';
  sections: ReportSection[];
  executiveSummary?: string;
  charts?: ReportChart[];
}

// ==================== Legacy Types (for compatibility) ====================

export interface SuggestedSlideElement {
  type: 'text' | 'image' | 'shape' | 'chart' | 'latex' | 'line';
  purpose: 'title' | 'subtitle' | 'content' | 'example' | 'diagram' | 'formula' | 'highlight';
  contentHint: string;
  position?: 'top' | 'center' | 'bottom' | 'left' | 'right';
  chartType?: 'bar' | 'line' | 'pie' | 'radar';
  textOutline?: string[];
}

export interface SuggestedAction {
  type: ActionType;
  description: string;
  timing?: 'start' | 'middle' | 'end' | 'after-content';
}

// ==================== Generation Session ====================

export interface GenerationProgress {
  currentStage: 1 | 2 | 3;
  overallProgress: number; // 0-100
  stageProgress: number; // 0-100
  statusMessage: string;
  scenesGenerated: number;
  totalScenes: number;
  errors?: string[];
}

export interface GenerationSession {
  id: string;
  requirements: UserRequirements;
  sceneOutlines?: SceneOutline[];
  progress: GenerationProgress;
  startedAt: Date;
  completedAt?: Date;
  generatedStageId?: string;
}
