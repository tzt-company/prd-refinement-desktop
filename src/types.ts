export type ReviewState = 'draft' | 'needs-clarification' | 'reviewed';

export interface SourceUnit {
  fileId?: string;
  fileRevision?: number;
  logicalPath?: string;
  sourceRole?: import('./material-types.js').MaterialRole;
  id: string;
  label: string;
  kind: 'heading' | 'paragraph' | 'table' | 'image' | 'attachment';
  excerpt: string;
  /** 仅用于理解当前单元的相邻结构，不计入原文覆盖率。 */
  context?: string;
  location: string;
  status: 'processed' | 'pending' | 'blocked';
  asset?: { path:string; mimeType:string; sha256:string; readStatus:'pending'|'read'|'blocked'; error?:string; extractedText?:string };
  synthetic?: boolean;
}

export interface RequirementRule {
  id: string;
  statement: string;
  sourceUnitIds: string[];
  conditions: string[];
  kind: 'behavior' | 'condition' | 'constraint' | 'exception' | 'data' | 'permission' | 'nonfunctional' | 'state' | 'validation' | 'migration' | 'dependency' | 'unknown';
  status: 'explicit' | 'unknown';
}

export type AuditCategory = 'source-ambiguity'|'rule-extraction'|'feature-boundary'|'detail-mismatch'|'unclassified';
export interface AuditIssue { id:string;direction:string;type:string;sourceUnitIds:string[];affectedIds:string[];detail:string; category?:AuditCategory; disposition?:'open'|'repaired'|'needs-confirmation'; repairAttempts?:number }
export interface RepairRecord { featureId:string; status:'accepted'|'rejected'; originalIssues:AuditIssue[]; before:RequirementDetail[]; beforeFeature?:Feature; candidateFeature?:Feature; candidate:RequirementDetail[]; verification:AuditIssue[]; reason?:string }
export interface GraphRepairRecord {
  scope:'rules'|'features';
  status:'accepted'|'rejected';
  issues:AuditIssue[];
  beforeIds:string[];
  afterIds:string[];
  verification?:AuditIssue[];
  reason?:string;
}

export type SourceDispositionKind = 'requirement' | 'clarification' | 'context' | 'example' | 'summary' | 'out-of-scope';
export interface SourceDisposition {
  sourceUnitId: string;
  kind: SourceDispositionKind;
  reason: string;
  featureIds: string[];
}
export interface RequirementAudit { passed:boolean;issues:AuditIssue[] }

export interface RequirementDetail {
  id: string;
  title: string;
  behavior: string;
  conditions: string[];
  constraints: string[];
  /** 仅保留 PRD 原文明确给出的验收条件，不由平台推导测试场景。 */
  explicitAcceptanceConditions: string[];
  sourceUnitIds: string[];
  ruleIds: string[];
  state: ReviewState;
}

export interface Feature {
  id: string;
  kind?: 'function' | 'constraint';
  appliesToFeatureIds?: string[];
  name: string;
  goal: string;
  sourceUnitIds: string[];
  ruleIds: string[];
  requirementIds: string[];
  state: ReviewState;
}

export interface Clarification {
  id: string;
  question: string;
  reason: string;
  affectedIds: string[];
  state: 'open' | 'resolved';
}

export interface PrdProject {
  materialBundle?: { id: string; revision: number };
  sourceDocuments?: Array<{fileId: string; revision: number; logicalPath: string; role: import('./material-types.js').MaterialRole; rawText: string}>;
  id: string;
  name: string;
  sourceName: string;
  sourceHash: string;
  revision: number;
  importedAt: string;
  rawText: string;
  stage: 'imported' | 'inventory' | 'refining' | 'review';
  sourceUnits: SourceUnit[];
  sourceDispositions?: SourceDisposition[];
  rules?: RequirementRule[];
  features: Feature[];
  requirements: RequirementDetail[];
  clarifications: Clarification[];
  audit?: RequirementAudit;
}

export interface RuntimeStatus {
  available: boolean;
  adapter?: 'codex-oauth' | 'dsh';
  version?: string;
  launcher?: string;
  reason?: string;
  routeReady?: boolean;
  authStatus?: 'authenticated' | 'unauthenticated' | 'error';
}

export interface RuntimeConfig {
  adapter: 'codex-oauth' | 'dsh';
  provider: string;
  model: string;
  apiKey?: string;
  reasoningEffort: 'default' | 'low' | 'medium' | 'high' | 'xhigh' | 'max' | 'ultra';
  fastModel?: string;
  fastReasoningEffort?: 'default' | 'low' | 'medium' | 'high' | 'xhigh' | 'max' | 'ultra';
  nodeProfiles?: Partial<Record<ModelNodeId, ModelProfile>>;
  maxParallel: number;
  maxNodeParallel?: number;
}

export type ModelNodeId = 'imageReading' | 'featureCandidates' | 'featureCandidateRepair' | 'featureGlobal' | 'featureCoverage' | 'detailsFast' | 'details' | 'audit' | 'repair';
export interface ModelProfile { model:string; reasoningEffort:RuntimeConfig['reasoningEffort'] }

export type RuntimeConfigSnapshot = Omit<RuntimeConfig, 'apiKey'> & {
  credentialRef?: 'system-runtime-config';
};

export interface AnalysisStep {
  id: string;
  name: string;
  note: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: number;
  completedAt?: number;
  runs?: number;
  durationMs?: number;
}

export interface RuntimeCallMetric {
  sessionId: string;
  adapter: 'codex-oauth' | 'dsh';
  model: string;
  reasoningEffort: RuntimeConfig['reasoningEffort'];
  startedAt: number;
  completedAt: number;
  durationMs: number;
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
}

export interface AnalysisTask {
  id: string;
  project: PrdProject;
  runtimeConfig?: RuntimeConfigSnapshot;
  attempt: number;
  checkpoint?: {
    pipelineVersion?: 2 | 3;
    candidateRepairRounds?: number[];
    unificationFeedback?: Array<Array<{ sourceUnitIds: string[]; detail: string }>>;
    unificationFeedbackRounds?: number;
    candidateCheckIssues?: Array<Array<{sourceUnitIds:string[];detail:string}>>;
    repairIssueIds?: string[];
    modelCallSequence?: number;
    materializedFeatureIds?: string[];
    featureClarificationIds?: Record<string,string[]>;
    boundaryCandidate?: {features:Feature[];dispositions:SourceDisposition[]};
    boundaryChecked?: boolean;
    boundaryUnified?: Feature[];
    rulesBatchCount?: number;
    featureCandidateBatchCount?: number;
    featureCoverageBatchCount?: number;
    auditBatchCount?: number;
    detailedFeatureIds: string[];
    auditedFeatureIds?: string[];
    auditIssues: AuditIssue[];
    featureCandidateBatches?: Feature[][];
    sourceDispositionBatches?: SourceDisposition[][];
    featureCoverageBatches?: Feature[][];
    detailResults?: Record<string,{requirements:RequirementDetail[];clarifications:Clarification[]}>;
    auditIssueBatches?: AuditIssue[][];
    repairedFeatureIds?: string[];
    featureCandidateFingerprint?: string;
    repairs?: RepairRecord[];
    graphRepairs?: GraphRepairRecord[];
    ruleRepairRounds?: number;
    featureRepairRounds?: number;
    crossFeatureAuditCompleted?: boolean;
  };
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  steps: AnalysisStep[];
  runtimeMetrics?: RuntimeCallMetric[];
  error?: string;
  audit?: unknown;
}

declare global {
  interface Window {
    prdApp: {
      materials: import('./material-types.js').MaterialApi;
      importPrd(file?: File): Promise<PrdProject | null>;
      loadProjects(): Promise<PrdProject[]>;
      saveProject(project: PrdProject): Promise<void>;
      inspectRuntime(config?: RuntimeConfig): Promise<RuntimeStatus>;
      prepareResult(project: PrdProject): Promise<string>;
      openResultDirectory(projectId: string): Promise<string>;
      loadRuntimeConfig(): Promise<RuntimeConfig>;
      saveRuntimeConfig(config: RuntimeConfig): Promise<void>;
      testRuntime(config: RuntimeConfig): Promise<RuntimeStatus>;
      loadAnalysisTasks(): Promise<AnalysisTask[]>;
      startAnalysis(project: PrdProject): Promise<AnalysisTask>;
      cancelAnalysis(taskId: string): Promise<void>;
      retryAnalysis(taskId: string): Promise<void>;
      onAnalysisTaskUpdate(callback: (task: AnalysisTask) => void): () => void;
    };
  }
}
