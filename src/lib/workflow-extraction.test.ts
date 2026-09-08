import { describe, expect, it } from "vitest";
import {
  createDefaultConditionStep,
  sourcesAtConditionPath,
  validateExtractionStep,
  validateWorkflowConditions,
  workflowSourcesBeforeStep,
  type WorkflowStep,
} from "./workflow-condition";

const http: WorkflowStep = { type: "http_request", node_id: "http1", url: "https://example.test" };
const wait: WorkflowStep = {
  type: "wait_message",
  node_id: "wait1",
  success: "ok",
  timeout_seconds: 60,
};
const extract: WorkflowStep = {
  type: "extract_variable",
  node_id: "extract1",
  name: "amount",
  source: "http_body",
  source_node_id: "http1",
  value_type: "number",
};
function condition(steps: WorkflowStep[] = []) {
  const node = createDefaultConditionStep();
  node.extracts = [];
  node.branches[0].conditions = [
    {
      variable: "amount",
      value_type: "number",
      operator: "gt",
      operands: [{ source: "literal", value: "0" }],
    },
  ];
  node.branches[0].steps = steps;
  return node;
}

describe("standalone extraction validation", () => {
  it("accepts HTTP extraction variables in downstream conditions", () => {
    expect(validateWorkflowConditions([http, extract, condition()])).toEqual([]);
  });
  it.each([
    [extract],
    [extract, http],
    [{ ...http, type: "wait_message" }, extract],
    [
      http,
      extract,
      condition([{ ...http, node_id: "branch-http" }]),
      { ...extract, name: "result", source_node_id: "branch-http" },
    ],
  ])("rejects removed, future, wrong-type and conditional sources: %j", (...steps) => {
    expect(validateWorkflowConditions(steps)).not.toEqual([]);
  });
  it("inherits sources through multiple nested branches", () => {
    const nested = condition([{ ...extract, name: "nestedValue" }]);
    const outer = condition([wait, nested]);
    expect(validateWorkflowConditions([http, extract, outer])).toEqual([]);
    expect(sourcesAtConditionPath(outer, [{ branchIndex: 0, stepIndex: 1 }], [http])).toEqual([
      http,
      wait,
    ]);
    expect(workflowSourcesBeforeStep([outer], 1, [http])).toEqual([http]);
  });
  it("does not expose sibling branch sources", () => {
    const outer = condition([{ ...http, node_id: "branch-http" }]);
    outer.branches[1].steps = [{ ...extract, name: "nestedValue", source_node_id: "branch-http" }];
    expect(validateWorkflowConditions([http, extract, outer])).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "steps.2.branches.1.steps.0",
          message: expect.stringContaining("数据源节点无效"),
        }),
      ]),
    );
  });
  it("validates regex even when the node editor was not opened", () => {
    const regexExtract = {
      ...extract,
      source: "wait_message_text",
      source_node_id: "wait1",
      mode: "regex_capture",
      pattern: "(",
    };
    expect(validateWorkflowConditions([wait, regexExtract])).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining("正则表达式语法无效") }),
      ]),
    );
    expect(validateExtractionStep({ ...regexExtract, pattern: "(\\d+)" }, [wait])).toEqual([]);
  });
  it("rejects duplicate standalone variables", () => {
    expect(
      validateWorkflowConditions([http, extract, { ...extract, node_id: "extract2" }]),
    ).toEqual(expect.arrayContaining([expect.objectContaining({ message: "变量名不能重复。" })]));
  });
});
