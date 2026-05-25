import { ResponseMocker } from "@kie/mock-github";
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
  outputs: Record<string, string>;
  groups?: Group[];
};

export type Group = {
  name: string;
  output: string;
};

export type RunOpts = {
  bind?: boolean;
  cwd?: string;
  workflowFile?: string;
  artifactServer?: {
    path: string;
    port?: string;
  };
  mockApi?: ResponseMocker<unknown, number>[];
  mockSteps?: MockStep;
  logFile?: string;
  verbose?: boolean;
};

export type ContainerOpts = {
  containerArchitecture?: string
  containerDaemonSocket?: string
  containerOptions?: string;
}
