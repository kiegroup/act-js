import { ResponseMocker } from "@aj/proxy/proxy.types";
import { MockStep } from "@aj/step-mocker/step-mocker.types";

export type Workflow = {
  jobId: string;
  jobName: string;
  workflowName: string;
  workflowFile: string;
  events: string;
};

export type Step = {
  name: string;
  status: number;
  output: string;
};

export type RunOpts = {
  cwd?: string;
  artifactServer?: {
    path: string;
    port: string;
  };
  mockApi?: ResponseMocker[];
  mockSteps?: MockStep;
};
