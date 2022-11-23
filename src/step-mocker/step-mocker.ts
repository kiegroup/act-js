import {
  GithubWorkflow,
  GithubWorkflowStep,
  isStepIdentifierUsingId,
  isStepIdentifierUsingName,
  isStepIdentifierUsingRun,
  isStepIdentifierUsingUses,
  MockStep,
  StepIdentifier,
} from "@aj/step-mocker/step-mocker.types";
import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { parse, stringify } from "yaml";

export class StepMocker {
  private workflowFile: string;
  private cwd: string;
  constructor(workflowFile: string, cwd: string) {
    this.workflowFile = workflowFile;
    this.cwd = cwd;
  }

  async mock(mockSteps: MockStep) {
    const filePath = this.getWorkflowPath();
    const workflow = await this.readWorkflowFile(filePath);
    for (const job of Object.keys(mockSteps)) {
      for (const mockStep of mockSteps[job]) {
        const step = this.locateStep(workflow, job, mockStep);
        if (step) {
          if (step.uses) {
            delete step["uses"];
          }
          step.run = mockStep.mockWith;
        } else {
          throw new Error(`Could not find step`);
        }
      }
    }
    return this.writeWorkflowFile(filePath, workflow);
  }

  private locateStep(
    workflow: GithubWorkflow,
    jobId: string,
    step: StepIdentifier
  ): GithubWorkflowStep | undefined {
    return workflow.jobs[jobId]?.steps.find((s) => {
      if (isStepIdentifierUsingId(step)) {
        return step.id === s.id;
      }

      if (isStepIdentifierUsingName(step)) {
        return step.name === s.name;
      }

      if (isStepIdentifierUsingUses(step)) {
        return step.uses === s.uses;
      }

      if (isStepIdentifierUsingRun(step)) {
        return step.run === s.run;
      }
      return false;
    });
  }

  private getWorkflowPath(): string {
    if (existsSync(path.join(this.cwd, this.workflowFile))) {
      return path.join(this.cwd, this.workflowFile);
    }
    if (this.cwd.endsWith(".github")) {
      return path.join(this.cwd, "workflows", this.workflowFile);
    } else if (
      existsSync(path.join(this.cwd, ".github", "workflows", this.workflowFile))
    ) {
      return path.join(this.cwd, ".github", "workflows", this.workflowFile);
    } else {
      throw new Error(`Could not locate ${this.workflowFile}`);
    }
  }

  private async readWorkflowFile(location: string): Promise<GithubWorkflow> {
    return parse(readFileSync(location, "utf8"));
  }

  private async writeWorkflowFile(location: string, data: any) {
    return writeFileSync(location, stringify(data), "utf8");
  }
}
