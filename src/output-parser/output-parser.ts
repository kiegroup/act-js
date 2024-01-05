import { DEFAULT_JOB } from "@aj/act/act.constants";
import { Group, Step } from "@aj/act/act.type";

export class OutputParser {
  private output: string;

  // keep track of steps for each job
  private stepMatrix: Record<string, Record<string, Step>>;

  // keep track of output for the current step of a job
  private outputMatrix: Record<string, string>;

  private outputsMatrix: Record<string, Record<string, string>>;

  // keep track of groups for the current step of a job
  private groupMatrix: Record<string, Group[]>;

  private isPartOfGroup: Record<string, boolean>;

  constructor(output: string) {
    this.output = output;
    this.stepMatrix = {};
    this.outputMatrix = {};
    this.outputsMatrix = {};
    this.groupMatrix = {};
    this.isPartOfGroup = {};
  }

  /**
   * Parse the output produced by running act successfully. Produces an object
   * describing whether the job was successful or not and what was the output of the job
   * @returns
   */
  parseOutput(): Step[] {
    const lines = this.output.split("\n").map(line => line.trim());
    for (const line of lines) {
      this.parseRun(line);
      this.parseSuccess(line);
      this.parseFailure(line);
      this.parseStartGroup(line);
      this.parseEndGroup(line);
      this.parseStepOutput(line);
      this.parseStepOutputs(line);
    }

    const result: Step[] = [];
    Object.values(this.stepMatrix).forEach(jobs => {
      Object.values(jobs).forEach(step => {
        result.push(step);
      });
    });
    return result;
  }

  /**
   * Check if the line indicates the start of a step. If it does then accordingly
   * update the bookkeeping variables
   * @param line
   */
  private parseRun(line: string) {
    // line that has a star followed by Run and step name
    const runMatcher = /^\s*(\[.+\])\s*\u2B50\s*Run\s*(.*)/;
    const runMatcherResult = runMatcher.exec(line);
    // if the line indicates the start of a step
    if (runMatcherResult !== null) {
      // initialize bookkeeping variables
      if (!this.stepMatrix[runMatcherResult[1]]) {
        this.stepMatrix[runMatcherResult[1]] = {};
        this.outputMatrix[runMatcherResult[1]] = "";
        this.outputsMatrix[runMatcherResult[1]] = {};
        this.groupMatrix[runMatcherResult[1]] = [];
      }

      // create a step object
      this.stepMatrix[runMatcherResult[1]][runMatcherResult[2].trim()] = {
        ...DEFAULT_JOB,
        name: runMatcherResult[2].trim(),
      };
    }
  }

  /**
   * Check if the line indicates that a step was successful. If it does then accordingly
   * update the bookkeeping variables
   * @param line
   */
  private parseSuccess(line: string) {
    // line that has a green tick mark
    const successMatcher = /^\s*(\[.+\])\s*\u2705\s*Success\s*-\s*(.*)/;
    const successMatcherResult = successMatcher.exec(line);
    // if the line indicates that a step was successful
    if (successMatcherResult !== null) {
      const groups = this.groupMatrix[successMatcherResult[1]];
      // store output in step
      this.stepMatrix[successMatcherResult[1]][successMatcherResult[2].trim()] =
        {
          ...this.stepMatrix[successMatcherResult[1]][
            successMatcherResult[2].trim()
          ],
          status: 0,
          output: this.outputMatrix[successMatcherResult[1]].trim(),
          outputs: this.outputsMatrix[successMatcherResult[1]],
          // only add groups attribute if there are any. don't add empty array
          ...(groups.length > 0 ? { groups } : {}),
        };
      this.resetOutputAndGroupMatrix(successMatcherResult[1]);
    }
  }

  /**
   * Check if the line indicates that a step failed. If it does then accordingly
   * update the bookkeeping variables
   * @param line
   */
  private parseFailure(line: string) {
    // line that has a red cross
    const failureMatcher = /^\s*(\[.+\])\s*\u274C\s*Failure\s*-\s*(.*)/;
    const failureMatcherResult = failureMatcher.exec(line);

    // if the line indicates that a step failed
    if (failureMatcherResult !== null) {
      // store output in step
      this.stepMatrix[failureMatcherResult[1]][failureMatcherResult[2].trim()] =
        {
          ...this.stepMatrix[failureMatcherResult[1]][
            failureMatcherResult[2].trim()
          ],
          status: 1,
          output: this.outputMatrix[failureMatcherResult[1]].trim(),
          outputs: this.outputsMatrix[failureMatcherResult[1]],
        };

      this.resetOutputAndGroupMatrix(failureMatcherResult[1]);
    }
  }

  /**
   * Check if the line indicates the start of a group annotation. If it does then accordingly
   * update the bookkeeping variables
   * @param line
   */
  private parseStepOutput(line: string) {
    // lines that have no emoji
    const stepOutputMatcher = /^\s*(\[.+\])\s*\|\s*(.*)/;
    const stepOutputMatcherResult = stepOutputMatcher.exec(line);

    // if the line is an output line
    if (stepOutputMatcherResult !== null) {
      // if output is part of some group then update it
      if (this.isPartOfGroup[stepOutputMatcherResult[1]]) {
        const length = this.groupMatrix[stepOutputMatcherResult[1]].length;
        this.groupMatrix[stepOutputMatcherResult[1]][length - 1].output +=
          stepOutputMatcherResult[2] + "\n";
      }
      this.outputMatrix[stepOutputMatcherResult[1]] +=
        stepOutputMatcherResult[2] + "\n";
    }
  }

  /**
   * Check if the line contains a set-output annotation. If it does then parse 
   * and store the output
   * @param line
   */
  private parseStepOutputs(line: string) {
    const stepOutputsMatcher = /^\s*(\[.+\])\s*\u2699\s*::set-output::\s*(.*)=(.*)/;
    const stepOutputsMatcherResult = stepOutputsMatcher.exec(line);

    // if the line is an output line
    if (stepOutputsMatcherResult !== null) {
      this.outputsMatrix[stepOutputsMatcherResult[1]][stepOutputsMatcherResult[2]] = stepOutputsMatcherResult[3];
    }
  }

  /**
   * Check if the line indicates the end of a group annotation. If it does then accordingly
   * update the bookkeeping variables
   * @param line
   */
  private parseStartGroup(line: string) {
    // lines that have a question mark
    const startGroupMatcher = /^\s*(\[.+\])\s*\u2753\s*::group::\s*(.*)/;

    const startGroupMatcherResult = startGroupMatcher.exec(line);

    // if the line indicates start of a group annotation
    if (startGroupMatcherResult !== null) {
      this.groupMatrix[startGroupMatcherResult[1]].push({
        name: startGroupMatcherResult[2],
        output: "",
      });
      this.isPartOfGroup[startGroupMatcherResult[1]] = true;
    }
  }

  /**
   * Check if the line is an output line. If it does then accordingly
   * update the bookkeeping variables
   * @param line
   */
  private parseEndGroup(line: string) {
    // lines that have a question mark
    const endGroupMatcher = /^\s*(\[.+\])\s*\u2753\s*::endgroup::\s*/;

    const endGroupMatcherResult = endGroupMatcher.exec(line);

    // if the line indicates stop of a group annotation then clean up trailing spaces
    if (endGroupMatcherResult !== null) {
      const length = this.groupMatrix[endGroupMatcherResult[1]].length;
      this.groupMatrix[endGroupMatcherResult[1]][length - 1].output =
        this.groupMatrix[endGroupMatcherResult[1]][length - 1].output.trim();
      this.isPartOfGroup[endGroupMatcherResult[1]] = false;
    }
  }

  private resetOutputAndGroupMatrix(job: string) {
    this.outputMatrix[job] = "";
    this.groupMatrix[job] = [];
  }
}
