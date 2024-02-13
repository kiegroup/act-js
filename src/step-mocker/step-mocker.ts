import {
  GithubWorkflow,
  GithubWorkflowStep,
  isStepIdentifierUsingAfter,
  isStepIdentifierUsingBefore,
  isStepIdentifierUsingBeforeOrAfter,
  isStepIdentifierUsingId,
  isStepIdentifierUsingIndex,
  isStepIdentifierUsingName,
  isStepIdentifierUsingRun,
  isStepIdentifierUsingUses,
  MockStep,
  StepIdentifier,
  StepIdentifierUsingAfter,
  StepIdentifierUsingBefore,
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
    for (const jobId of Object.keys(mockSteps)) {
      const stepsToAdd = [];
      for (const mockStep of mockSteps[jobId]) {
        const { step, stepIndex } = this.locateStep(workflow, jobId, mockStep);
        if (step) {
          if (isStepIdentifierUsingBeforeOrAfter(mockStep)) {
            // need to adjust the step index if there were elements added previously
            const adjustIndex: number = stepsToAdd.filter(s => s.stepIndex < stepIndex).length;
            // we will only actually add the steps at the end so as to avoid indexing errors in subsequent add steps
            stepsToAdd.push({jobId, stepIndex: stepIndex + adjustIndex, mockStep});
          } else {
            this.updateStep(workflow, jobId, stepIndex, mockStep);
          }
        } else {
          const { mockWith: _, ...stepQuery } = mockStep;
          throw new Error(`Could not find step ${JSON.stringify(stepQuery)} in job ${jobId}\nin ${filePath}`);
        }
      }
      stepsToAdd.forEach(s => this.addStep(workflow, s.jobId, s.stepIndex, s.mockStep));
    }
    return this.writeWorkflowFile(filePath, workflow);
  }

  private addStep(
    workflow: GithubWorkflow,
    jobId: string,
    stepIndex: number,
    mockStep: StepIdentifierUsingAfter | StepIdentifierUsingBefore
  ) {
    if (workflow.jobs[jobId]) {
      let indexToInsertAt = stepIndex;
      if (isStepIdentifierUsingBefore(mockStep)) {
        indexToInsertAt = stepIndex <= 0 ? 0 : indexToInsertAt - 1;
      } else {
        indexToInsertAt =
          stepIndex >= workflow.jobs[jobId].steps.length - 1
            ? workflow.jobs[jobId].steps.length
            : indexToInsertAt + 1;
      }
      workflow.jobs[jobId].steps.splice(indexToInsertAt, 0, {...mockStep.mockWith});
    }
  }

  private updateStep(
    workflow: GithubWorkflow,
    jobId: string,
    stepIndex: number,
    mockStep: StepIdentifier
  ) {
    if (workflow.jobs[jobId]) {
      const oldStep = workflow.jobs[jobId].steps[stepIndex];
      const newStep =
        typeof mockStep.mockWith === "string"
          ? {
              ...oldStep,
              run: mockStep.mockWith,
              uses: undefined,
            }
          : mockStep.mockWith;
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
    const index = workflow.jobs[jobId]?.steps.findIndex((s, index) => {
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

      if (isStepIdentifierUsingIndex(step)) {
        return step.index === index;
      }

      if (isStepIdentifierUsingBefore(step)) {
        return typeof step.before === "string"
          ? [s.id, s.name, s.uses, s.run].includes(step.before)
          : step.before === index;
      }

      if (isStepIdentifierUsingAfter(step)) {
        return typeof step.after === "string"
          ? [s.id, s.name, s.uses, s.run].includes(step.after)
          : step.after === index;
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
