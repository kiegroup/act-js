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
        const { step, stepIndex } = this.locateStep(workflow, job, mockStep);
        if (step) {
          if (typeof mockStep.mockWith === "string") {
            this.updateStep(workflow, job, stepIndex, {
              ...step,
              run: mockStep.mockWith,
              uses: undefined,
            });
          } else {
            this.updateStep(workflow, job, stepIndex, mockStep.mockWith);
          }
        } else {
          throw new Error("Could not find step");
        }
      }
    }
    return this.writeWorkflowFile(filePath, workflow);
  }

  private updateStep(
    workflow: GithubWorkflow,
    jobId: string,
    stepIndex: number,
    newStep: GithubWorkflowStep
  ) {
    if (workflow.jobs[jobId]) {
      const oldStep = workflow.jobs[jobId].steps[stepIndex];
      const updatedStep = { ...oldStep, ...newStep };

      for (const key of Object.keys(oldStep)) {
        if (key === "env" || key === "with") {
          updatedStep[key] = {
            ...oldStep[key],
            ...(newStep[key] ?? {}),
          };
        }
      }

      workflow.jobs[jobId].steps[stepIndex] = updatedStep;
    }
  }

  private locateStep(
    workflow: GithubWorkflow,
    jobId: string,
    step: StepIdentifier
  ): { stepIndex: number; step: GithubWorkflowStep | undefined } {
    const index = workflow.jobs[jobId]?.steps.findIndex(s => {
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

    return {
      stepIndex: index,
      step: index > -1 ? workflow.jobs[jobId]?.steps[index] : undefined,
    };
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

  private async writeWorkflowFile(location: string, data: unknown) {
    return writeFileSync(location, stringify(data), "utf8");
  }
}
