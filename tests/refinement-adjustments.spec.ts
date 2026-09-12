import { describe, expect, it } from "vitest";
import {
  RefinementAdjustmentEngine,
  type AdjustmentModelAdapter,
} from "../electron/refinement-adjustments";
import type { PrdProject, SourceUnit } from "../src/types";

const unit = (id: string, text: string): SourceUnit => ({
  id,
  label: id,
  kind: "paragraph",
  excerpt: text,
  location: id,
  status: "processed",
});
const detail = (
  id: string,
  title: string,
  behavior: string,
  sourceUnitId: string,
) => ({
  id,
  title,
  behavior,
  conditions: [],
  constraints: [],
  explicitAcceptanceConditions: [],
  sourceUnitIds: [sourceUnitId],
  evidenceBindings: {
    behavior: [{ sourceUnitId }],
    conditions: [],
    constraints: [],
    explicitAcceptanceConditions: [],
  },
  ruleIds: [],
  state: "reviewed" as const,
});
const project = (): PrdProject => ({
  id: "P",
  name: "PRD",
  sourceName: "prd.md",
  sourceHash: "H",
  revision: 1,
  importedAt: "now",
  rawText: "",
  stage: "review",
  sourceUnits: [
    unit("S1", "用户可以提交订单。"),
    unit("S2", "用户可以取消订单。"),
    unit("S3", "用户可以查询订单。"),
  ],
  features: [
    {
      id: "F1",
      name: "提交订单",
      sourceUnitIds: ["S1"],
      sourceRefs: [{ sourceUnitId: "S1" }],
      ruleIds: [],
      requirementIds: ["R1"],
      state: "reviewed",
    },
    {
      id: "F2",
      name: "取消订单",
      sourceUnitIds: ["S2"],
      sourceRefs: [{ sourceUnitId: "S2" }],
      ruleIds: [],
      requirementIds: ["R2"],
      state: "reviewed",
    },
    {
      id: "F3",
      name: "查询订单",
      sourceUnitIds: ["S3"],
      sourceRefs: [{ sourceUnitId: "S3" }],
      ruleIds: [],
      requirementIds: ["R3"],
      state: "reviewed",
    },
  ],
  requirements: [
    detail("R1", "提交", "用户可以提交订单", "S1"),
    detail("R2", "取消", "用户可以取消订单", "S2"),
    detail("R3", "查询", "用户可以查询订单", "S3"),
  ],
  clarifications: [
    {
      id: "Q1",
      question: "是否允许重复提交？",
      reason: "原文未说明",
      affectedIds: ["R1"],
      state: "open",
      level: "blocking",
    },
    {
      id: "Q2",
      question: "提交后是否通知？",
      reason: "原文未说明",
      affectedIds: ["R1"],
      state: "open",
      level: "suggestion",
    },
    {
      id: "Q3",
      question: "取消原因是否必填？",
      reason: "原文未说明",
      affectedIds: ["R2"],
      state: "open",
      level: "blocking",
    },
  ],
});
const req = (
  input: any,
  targetId: string,
  behavior: string,
  evidenceId?: string,
) => {
  const chosen = evidenceId
    ? input.evidenceCatalog.find((x: any) => x.sourceUnitId === evidenceId)
    : input.evidenceCatalog.find((x: any) => x.text.includes(behavior));
  return {
    id: targetId,
    title: behavior,
    behavior,
    conditions: [],
    constraints: [],
    explicitAcceptanceEvidenceIds: [],
    evidenceBindings: {
      behavior: [chosen.id],
      conditions: [],
      constraints: [],
      explicitAcceptanceConditions: [],
    },
    state: "reviewed",
  };
};
const empty = () => ({
  requirementActions: [],
  clarificationActions: [],
  relationActions: [],
});
const request = (feedback: string) => ({
  baseTaskId: "T",
  baseVersion: 1,
  feedback,
});
const adapter = (
  fn: (call: Parameters<AdjustmentModelAdapter["generate"]>[0]) => unknown,
): AdjustmentModelAdapter => ({ generate: async (call) => fn(call) });

describe("任务级自然语言批量调整", () => {
  it("跨两功能只处理命中范围，同一功能的多条意见只生成一次", async () => {
    const feedback = "提交订单合并描述；提交订单标题简化；取消订单展开步骤。",
      generated: string[] = [];
    const engine = new RefinementAdjustmentEngine(
      adapter((call) => {
        if (call.title === "解析任务调整说明")
          return {
            operations: [
              {
                id: "O1",
                quote: "提交订单合并描述",
                kind: "organization",
                instruction: "合并",
                featureIds: ["F1"],
                clarificationIds: [],
              },
              {
                id: "O2",
                quote: "提交订单标题简化",
                kind: "organization",
                instruction: "简化",
                featureIds: ["F1"],
                clarificationIds: [],
              },
              {
                id: "O3",
                quote: "取消订单展开步骤",
                kind: "organization",
                instruction: "展开",
                featureIds: ["F2"],
                clarificationIds: [],
              },
            ],
            pending: [],
          };
        if (call.title.includes("依据核查"))
          return { passed: true, issues: [], clarificationResolutions: [] };
        generated.push(call.title);
        return empty();
      }),
    );
    const run = await engine.run(
      { taskId: "T", version: 1, project: project() },
      request(feedback),
    );
    expect(run.status).toBe("completed");
    expect(generated).toHaveLength(2);
    expect(generated.filter((x) => x.includes("提交订单"))).toHaveLength(1);
    expect(run.diff.updatedFeatureIds).toEqual(["F1", "F2"]);
    expect(run.project.features.find((x) => x.id === "F3")).toEqual(
      project().features[2],
    );
  });

  it("按原文片段分离整理指令和业务事实，整理指令不能充当依据", async () => {
    const feedback = "提交订单写得更简洁；提交订单允许重复提交。";
    const engine = new RefinementAdjustmentEngine(
      adapter((call) => {
        if (call.title === "解析任务调整说明")
          return {
            operations: [
              {
                id: "O1",
                quote: "提交订单写得更简洁",
                kind: "organization",
                instruction: "精简",
                featureIds: ["F1"],
                clarificationIds: [],
              },
              {
                id: "O2",
                quote: "提交订单允许重复提交",
                kind: "business-fact",
                instruction: "补充口径",
                featureIds: ["F1"],
                clarificationIds: ["Q1"],
              },
            ],
            pending: [],
          };
        if (call.title.includes("依据核查"))
          return { passed: true, issues: [], clarificationResolutions: [] };
        return empty();
      }),
    );
    const run = await engine.run(
      { taskId: "T", version: 1, project: project() },
      request(feedback),
    );
    expect(run.userEvidence.map((x) => [x.content, x.businessFact])).toEqual([
      ["提交订单写得更简洁", false],
      ["提交订单允许重复提交", true],
    ]);
    expect(
      run.project.sourceUnits
        .filter((x) => x.id.startsWith("USER-"))
        .map((x) => x.excerpt),
    ).toEqual(["提交订单允许重复提交"]);
  });

  it("歧义只形成待确认，不修改项目", async () => {
    const base = project(),
      feedback = "把审核部分展开。";
    const engine = new RefinementAdjustmentEngine(
      adapter((call) => {
        if (call.title === "解析任务调整说明")
          return {
            operations: [],
            pending: [
              {
                id: "P1",
                quote: "审核部分",
                question: "你指的是退款审核还是发票审核？",
                candidateFeatureIds: ["F1", "F2"],
                candidateClarificationIds: [],
              },
            ],
          };
        throw new Error("不应生成");
      }),
    );
    const run = await engine.run(
      { taskId: "T", version: 1, project: base },
      request(feedback),
    );
    expect(run.results).toEqual([
      {
        operationId: "P1",
        status: "needs-confirmation",
        featureIds: ["F1", "F2"],
        clarificationIds: [],
        detail: "你指的是退款审核还是发票审核？",
      },
    ]);
    expect({ ...run.project, revision: 1, userEvidence: undefined }).toEqual({
      ...base,
      userEvidence: undefined,
    });
  });

  it("一个答案可关闭多个明确关联澄清，defer 的问题保持 open", async () => {
    const feedback =
      "提交订单允许重复提交且提交后要通知；取消原因问题暂不处理。";
    const engine = new RefinementAdjustmentEngine(
      adapter((call) => {
        if (call.title === "解析任务调整说明")
          return {
            operations: [
              {
                id: "O1",
                quote: "提交订单允许重复提交且提交后要通知",
                kind: "business-fact",
                instruction: "落实提交口径",
                featureIds: ["F1"],
                clarificationIds: ["Q1", "Q2"],
              },
              {
                id: "O2",
                quote: "取消原因问题暂不处理",
                kind: "defer",
                instruction: "保留",
                featureIds: ["F2"],
                clarificationIds: ["Q3"],
              },
            ],
            pending: [],
          };
        if (call.title.includes("依据核查"))
          return {
            passed: true,
            issues: [],
            clarificationResolutions: [
              { clarificationId: "Q1", status: "supported", reason: "已承接" },
              { clarificationId: "Q2", status: "supported", reason: "已承接" },
            ],
          };
        const input = call.input as any,
          user = input.evidenceCatalog.find((x: any) =>
            x.sourceUnitId.startsWith("USER-"),
          );
        return {
          requirementActions: [
            {
              action: "update",
              targetId: "R1",
              requirement: req(
                input,
                "R1",
                "允许重复提交且提交后通知",
                user.sourceUnitId,
              ),
            },
          ],
          clarificationActions: [
            {
              action: "resolve",
              targetId: "Q1",
              satisfiedRequirementIds: ["R1"],
              resolutionEvidenceIds: [user.sourceUnitId],
            },
            {
              action: "resolve",
              targetId: "Q2",
              satisfiedRequirementIds: ["R1"],
              resolutionEvidenceIds: [user.sourceUnitId],
            },
          ],
          relationActions: [],
        };
      }),
    );
    const run = await engine.run(
      { taskId: "T", version: 1, project: project() },
      request(feedback),
    );
    expect(run.project.clarifications.find((x) => x.id === "Q1")?.state).toBe(
      "resolved",
    );
    expect(run.project.clarifications.find((x) => x.id === "Q2")?.state).toBe(
      "resolved",
    );
    expect(run.project.clarifications.find((x) => x.id === "Q3")?.state).toBe(
      "open",
    );
    expect(run.results.find((x) => x.operationId === "O2")?.status).toBe(
      "deferred",
    );
  });

  it("同一原子组第二个功能失败时回滚第一个功能", async () => {
    const feedback = "提交和取消统一精简。";
    const engine = new RefinementAdjustmentEngine(
      adapter((call) => {
        if (call.title === "解析任务调整说明")
          return {
            operations: [
              {
                id: "O1",
                quote: "提交和取消统一精简",
                kind: "organization",
                instruction: "精简提交",
                featureIds: ["F1"],
                clarificationIds: [],
                atomicGroupId: "G1",
              },
              {
                id: "O2",
                quote: "提交和取消统一精简",
                kind: "organization",
                instruction: "精简取消",
                featureIds: ["F2"],
                clarificationIds: [],
                atomicGroupId: "G1",
              },
            ],
            pending: [],
          };
        if (call.title.includes("依据核查"))
          return { passed: true, issues: [], clarificationResolutions: [] };
        if (call.title.includes("取消订单"))
          throw new Error("取消功能生成失败");
        const input = call.input as any;
        const changed = req(input, "R1", "用户可以提交订单");
        changed.title = "精简提交";
        return {
          requirementActions: [
            { action: "update", targetId: "R1", requirement: changed },
          ],
          clarificationActions: [],
          relationActions: [],
        };
      }),
    );
    const run = await engine.run(
      { taskId: "T", version: 1, project: project() },
      request(feedback),
    );
    expect(run.status).toBe("failed");
    expect(run.project.requirements.find((x) => x.id === "R1")?.title).toBe(
      "提交",
    );
    expect(run.diff.updatedFeatureIds).toEqual([]);
    expect(run.results.filter((x) => x.status === "failed")).toHaveLength(2);
  });

  it("独立组一成一败时保留成功结果并返回 completed", async () => {
    const feedback = "提交精简；取消展开。";
    const engine = new RefinementAdjustmentEngine(
      adapter((call) => {
        if (call.title === "解析任务调整说明")
          return {
            operations: [
              {
                id: "O1",
                quote: "提交精简",
                kind: "organization",
                instruction: "精简",
                featureIds: ["F1"],
                clarificationIds: [],
              },
              {
                id: "O2",
                quote: "取消展开",
                kind: "organization",
                instruction: "展开",
                featureIds: ["F2"],
                clarificationIds: [],
              },
            ],
            pending: [],
          };
        if (call.title.includes("依据核查"))
          return { passed: true, issues: [], clarificationResolutions: [] };
        if (call.title.includes("取消订单"))
          throw new Error("取消功能生成失败");
        const input = call.input as any;
        const changed = req(input, "R1", "用户可以提交订单");
        changed.title = "精简提交";
        return {
          requirementActions: [
            { action: "update", targetId: "R1", requirement: changed },
          ],
          clarificationActions: [],
          relationActions: [],
        };
      }),
    );
    const run = await engine.run(
      { taskId: "T", version: 1, project: project() },
      request(feedback),
    );
    expect(run.status).toBe("completed");
    expect(run.project.requirements.find((x) => x.id === "R1")?.title).toBe(
      "精简提交",
    );
    expect(run.results.find((x) => x.operationId === "O1")?.status).toBe(
      "applied",
    );
    expect(run.results.find((x) => x.operationId === "O2")?.status).toBe(
      "failed",
    );
  });
});
