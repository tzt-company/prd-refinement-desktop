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

export interface SourceRef {
  sourceUnitId: string;
  /** UTF-16 左闭右开选区；省略表示引用整个来源单元。 */
  start?: number;
  end?: number;
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
export type AuditOwner = 'feature-grouping'|'requirement-detail'|'requirement-relation'|'source-decision'|'runtime-output';
export interface AuditIssue { id:string;identityKey?:string;direction:string;type:string;sourceUnitIds:string[];affectedIds:string[];detail:string; category?:AuditCategory; owner?:AuditOwner; clarificationId?:string; clarificationDraft?:Clarification; disposition?:'open'|'repaired'|'needs-confirmation'|'dismissed'; repairAttempts?:number; dependencyHash?:string; closedDependencyHash?:string; aliases?:string[] }
export interface RepairTargetResult { issueId:string; status:'resolved'|'unresolved'; reason:string }
export interface RepairReview { originalIssueResults:RepairTargetResult[]; introducedIssues:AuditIssue[]; discoveredIssues:AuditIssue[] }
export interface RepairRecord { featureId:string; status:'accepted'|'rejected'; originalIssues:AuditIssue[]; before:RequirementDetail[]; beforeFeature?:Feature; candidateFeature?:Feature; candidate:RequirementDetail[]; verification:AuditIssue[]; originalIssueResults?:RepairTargetResult[]; introducedIssues?:AuditIssue[]; discoveredIssues?:AuditIssue[]; reason?:string }
export interface RepairAttemptRecord {
  id:string;
  scopeKey:string;
  round:number;
  targetIssueIds:string[];
  baseFingerprint:string;
  state:'planned'|'candidate-ready'|'review-ready'|'verified-rejected'|'committed'|'invalid-output'|'stale'|'no-progress';
  scope:{featureIds:string[];requirementIds:string[];clarificationIds:string[];sourceUnitIds:string[];requiredSourceUnitIds:string[];readOnlyRequirementIds:string[]};
  patch?:{requirements:Array<RequirementDetail&{featureId:string}>;deleteRequirementIds:string[];clarifications:Clarification[];deleteClarificationIds:string[]};
  candidate?:{requirements:RequirementDetail[];clarifications:Clarification[]};
  review?:RepairReview;
  reason?:string;
  dependencyHash?:string;
  candidateFingerprint?:string;
  commitVersion?:number;
}
export type RequiredCheckId='source'|'feature'|'detail'|'relation'|'clarification';
export interface AnalysisCheckRecord { id:RequiredCheckId; resultVersion:number; dependencyHash:string; status:'passed'|'failed'|'unknown'|'stale'; checkedAt:number; issueIds:string[] }
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
  evidenceBindings?: {
    behavior: SourceRef[];
    conditions: SourceRef[][];
    constraints: SourceRef[][];
    explicitAcceptanceConditions: SourceRef[][];
  };
  ruleIds: string[];
  state: ReviewState;
}

export interface Feature {
  id: string;
  kind?: 'function' | 'constraint';
  appliesToFeatureIds?: string[];
  /** 便于人工导航的模型生成名称，不作为业务需求事实。 */
  name?: string;
  /** 旧任务只读字段；新任务不得生成或依赖。 */
  goal?: string;
  sourceUnitIds: string[];
  sourceRefs?: SourceRef[];
  ruleIds: string[];
  requirementIds: string[];
  state: ReviewState;
}

export interface Clarification {
  id: string;
  question: string;
  reason: string;
  /** 对正式 Agent 交付的影响级别。旧任务缺省时按 blocking 展示。 */
  level?: 'blocking' | 'suggestion' | 'ignorable';
  knownFacts?: string;
  unresolvedPoint?: string;
  impact?: string;
  levelReason?: string;
  /** suggestion 必须说明用户暂不处理时采用的既有明确口径。 */
  defaultResolution?: string;
  sourceRefs?: SourceRef[];
  affectedIds: string[];
  state: 'open' | 'resolved' | 'dismissed';
  auditIssueIds?: string[];
  /** 全局合并后保留的历史澄清编号，用于恢复旧引用。 */
  aliases?: string[];
  resolutionSourceUnitIds?: string[];
}

export interface RequirementRelation {
  id: string;
  sourceRequirementId: string;
  targetRequirementId: string;
  kind: 'depends-on'|'affects'|'exception-to';
  sourceRefs: SourceRef[];
}

export type DeliveryState = 'ready'|'blocked'|'unchecked';
export interface DeliveryAssessment {
  state: DeliveryState;
  inputHash: string;
  resultHash: string;
  issueIds: string[];
  unverifiedScopeIds: string[];
  policyVersion: number;
}

export interface PrdProject {
  materialBundle?: { id: string; revision: number };
  /** 分析任务固化的自包含输入目录。 */
  inputSnapshotPath?: string;
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
  relations?: RequirementRelation[];
  audit?: RequirementAudit;
  delivery?: DeliveryAssessment;
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

export interface PromptCallMetric {
  sessionId:string;
  node:ModelNodeId;
  purpose:string;
  queuedAt:number;
  startedAt:number;
  queueMs:number;
  characters:number;
  bytes:number;
  estimatedTokens:number;
  estimateMethod:'cjk-and-ascii-v1';
  sections:Record<string,number>;
  budgetClass:'candidate'|'audit'|'repair';
  targetTokens:number;
  hardTokens:number;
}

export interface AnalysisTask {
  id: string;
  project: PrdProject;
  runtimeConfig?: RuntimeConfigSnapshot;
  attempt: number;
  checkpoint?: {
    pipelineVersion?: 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;
    resultVersion?:number;
    checks?:Partial<Record<RequiredCheckId,AnalysisCheckRecord>>;
    validationFailures?: Array<{sessionId:string;node:ModelNodeId;purpose:string;message:string;responsePath:string;at:number}>;
    candidateRepairRounds?: number[];
    unificationFeedback?: Array<Array<{ sourceUnitIds: string[]; detail: string }>>;
    unificationFeedbackRounds?: number;
    candidateCheckIssues?: Array<Array<{sourceUnitIds:string[];detail:string}>>;
    repairIssueIds?: string[];
    repairAttempts?: Record<string,number>;
    repairFeedback?: Record<string,AuditIssue[]>;
    repairAttemptsV2?: RepairAttemptRecord[];
    confirmedIssueIds?: string[];
    sourceCoverageDecisions?:Record<string,{status:'covered-by-existing'|'not-a-requirement';issueId:string;reason:string;at:number}>;
    relationRepairAttempts?: Record<string,number>;
    boundaryFeedback?: AuditIssue[];
    modelCallSequence?: number;
    deadlineAt?:number;
    promptMetrics?:PromptCallMetric[];
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
    relationBatches?: RequirementRelation[][];
    repairedFeatureIds?: string[];
    featureCandidateFingerprint?: string;
    repairs?: RepairRecord[];
    graphRepairs?: GraphRepairRecord[];
    ruleRepairRounds?: number;
    featureRepairRounds?: number;
    crossFeatureAuditCompleted?: boolean;
  };
  status: 'queued' | 'running' | 'completed' | 'needs-attention' | 'failed';
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
