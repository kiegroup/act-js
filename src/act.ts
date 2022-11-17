import { spawn } from "child_process";
import { RunOpts, Step, Workflow } from "@aj/act.type";
import { DEFAULT_JOB, ACT_BINARY } from "@aj/act.constants";
import { existsSync, writeFileSync } from "fs";
import path from "path";
import { homedir } from "os";
import { ForwardProxy } from "@aj/proxy/proxy";
import { ArgumentMap } from "@aj/map/argument-map";

export class Act {
  private secrets: ArgumentMap;
  private cwd: string;
  private env: ArgumentMap;

  constructor(cwd?: string, defaultImageSize?: string) {
    this.secrets = new ArgumentMap("-s");
    this.cwd = cwd ?? process.cwd();
    this.env = new ArgumentMap("--env");
    this.setDefaultImage(defaultImageSize);
  }

  setCwd(cwd: string) {
    this.cwd = cwd;
    return this;
  }

  getCwd() {
    return this.cwd;
  }

  setSecret(key: string, val: string) {
    this.secrets.map.set(key, val);
    return this;
  }

  deleteSecret(key: string) {
    this.secrets.map.delete(key);
    return this;
  }

  clearSecret() {
    this.secrets.map.clear();
    return this;
  }

  setEnv(key: string, val: string) {
    this.env.map.set(key, val);
    return this;
  }

  deleteEnv(key: string) {
    this.env.map.delete(key);
    return this;
  }

  clearEnv() {
    this.env.map.clear();
    return this;
  }

  /**
   * List available workflows.
   * If working directory is not specified then node's current working directory is used
   * You can also list workflows specific to an event by passing the event name
   * @param cwd
   * @param event
   */
  async list(event?: string, cwd: string = this.getCwd()): Promise<Workflow[]> {
    const response = await this.act(cwd, ...(event ? [event, "-l"] : ["-l"]));

    return response
      .split("\n")
      .slice(1, -1) // remove first (title columns) and last column
      .filter((element) => element !== "" && element.split("  ").length > 1) // remove empty strings and warnings
      .map((element) => {
        const splitElement = element.split("  ").filter((val) => val !== ""); // remove emoty strings
        return {
          jobId: splitElement[1].trim(),
          jobName: splitElement[2].trim(),
          workflowName: splitElement[3].trim(),
          workflowFile: splitElement[4].trim(),
          events: splitElement[5].trim(),
        };
      });
  }

  async runJob(jobId: string, opts?: RunOpts): Promise<Step[]> {
    return this.run(["-j", jobId], opts);
  }

  async runEvent(event: string, opts?: RunOpts): Promise<Step[]> {
    return this.run([event], opts);
  }

  // wrapper around the act cli command
  private act(cwd: string, ...args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      // do not use spawnSync. will cause a deadlock when used with proxy settings
      const childProcess = spawn(ACT_BINARY, ["-W", cwd, ...args], { cwd });
      let data = "";
      let error = "";
      childProcess.stdout.on("data", (chunk) => {
        data += chunk.toString();
      });
      childProcess.stderr.on("data", (chunk) => {
        error += chunk.toString();
      });

      childProcess.on("close", (code) => {
        if (
          code === null ||
          /Cannot connect to the Docker daemon at .+/.test(error)
        ) {
          reject(error);
        } else {
          resolve(data);
        }
      });
    });
  }

  /**
   * Run the actual act binary. Pass any necessary env or secrets formatted according to the cli's requirements
   * @param cmd 
   * @param opts 
   * @returns 
   */
  private async run(cmd: string[], opts?: RunOpts): Promise<Step[]> {
    const secrets = this.secrets.toActArguments();
    let proxy: ForwardProxy | undefined = undefined;
    if (opts?.mockApi) {
      proxy = new ForwardProxy(opts.mockApi);
      const address = await proxy.start();
      this.setEnv("http_proxy", `http://${address}`);
      this.setEnv("https_proxy", `http://${address}`);
      this.setEnv("HTTP_PROXY", `http://${address}`);
      this.setEnv("HTTPS_PROXY", `http://${address}`);
    }
    const env = this.env.toActArguments();
    const response = await this.act(
      opts?.cwd ?? this.getCwd(),
      ...cmd,
      ...secrets,
      ...env,
      ...(opts?.artifactServer
        ? [
            "--artifact-server-path",
            opts?.artifactServer.path,
            "--artifact-server-port",
            opts?.artifactServer.port,
          ]
        : [])
    );
    if (proxy) {
      await proxy.stop();
    }
    return this.extractRunOutput(response);
  }

  /**
   * Parse the output produced by running act successfully. Produces an object
   * describing whether the job was successful or not and what was the output of the job
   * @param output
   * @returns
   */
  private extractRunOutput(output: string): Step[] {
    // line that has a star followed by Run and job name
    const runMatcher = /^\s*(\[.+\])\s*\u2B50\s*Run\s*(.*)/;
    // line that has a green tick mark
    const successMatcher = /^\s*(\[.+\])\s*\u2705\s*Success\s*-\s*(.*)/;
    // line that has a red cross
    const failureMatcher = /^\s*(\[.+\])\s*\u274C\s*Failure\s*-\s*(.*)/;
    // lines that have no emoji
    const runOutputMatcher = /^\s*(\[.+\])\s*\|\s*(.*)/;

    // keep track of steps for each job
    const matrix: Record<string, Record<string, Step>> = {};

    // keep track of the most recent output for a job
    const matrixOutput: Record<string, string> = {};

    const lines = output.split("\n").map((line) => line.trim());
    for (const line of lines) {
      const runMatcherResult = runMatcher.exec(line);
      const successMatcherResult = successMatcher.exec(line);
      const failureMatcherResult = failureMatcher.exec(line);
      const runOutputMatcherResult = runOutputMatcher.exec(line);

      // if the line indicates the start of a step
      if (runMatcherResult !== null) {
        // initialize bookkeeping variables
        if (!matrix[runMatcherResult[1]]) {
          matrix[runMatcherResult[1]] = {};
          matrixOutput[runMatcherResult[1]] = "";
        }

        // create a step object
        matrix[runMatcherResult[1]][runMatcherResult[2].trim()] = {
          ...DEFAULT_JOB,
          name: runMatcherResult[2].trim(),
        };
      }
      // if the line indicates that a step was successful
      else if (successMatcherResult !== null) {
        // store output in step
        matrix[successMatcherResult[1]][successMatcherResult[2].trim()] = {
          ...matrix[successMatcherResult[1]][successMatcherResult[2].trim()],
          status: 0,
          output: matrixOutput[successMatcherResult[1]].trim(),
        };

        // reset output
        matrixOutput[successMatcherResult[1]] = "";
      }
      // if the line indicates that a step failed
      else if (failureMatcherResult !== null) {
        // store output in step
        matrix[failureMatcherResult[1]][failureMatcherResult[2].trim()] = {
          ...matrix[failureMatcherResult[1]][failureMatcherResult[2].trim()],
          status: 1,
          output: matrixOutput[failureMatcherResult[1]].trim(),
        };

        // reset output
        matrixOutput[failureMatcherResult[1]] = "";
      }
      // if the line is an output line
      else if (runOutputMatcherResult !== null) {
        matrixOutput[runOutputMatcherResult[1]] +=
          runOutputMatcherResult[2] + "\n";
      }
    }

    let result: Step[] = [];
    Object.values(matrix).forEach((jobs) => {
      Object.values(jobs).forEach((step) => {
        result.push(step);
      });
    });
    return result;
  }

  /**
   * Produce a .actrc file in the home directory of the user if it does not exist
   * @param defaultImageSize 
   */
  private setDefaultImage(defaultImageSize?: string) {
    const actrcPath = path.join(homedir(), ".actrc");
    const ubuntuLatest = "-P ubuntu-latest=";
    const ubuntu2004 = "-P ubuntu-20.04=";
    const ubuntu1804 = "-P ubuntu-18.04=";
    const ubuntu2204 = "-P ubuntu-22.04=";
    const catthehacker = "ghcr.io/catthehacker/";

    if (!existsSync(actrcPath)) {
      let actrc = "";
      switch (defaultImageSize ?? "medium") {
        case "micro":
          actrc = `${ubuntuLatest}node:16-buster-slim\n${ubuntu2004}node:16-buster-slim\n${ubuntu1804}node:16-buster-slim\n${ubuntu2204}node:16-bullseye-slim`;
          break;
        case "medium":
          actrc = `${ubuntuLatest}${catthehacker}ubuntu:act-latest\n${ubuntu2004}${catthehacker}ubuntu:act-20.04\n${ubuntu1804}${catthehacker}ubuntu:act-18.04\n${ubuntu2204}${catthehacker}ubuntu:act-22.04`;
          break;
        case "large":
          actrc = `${ubuntuLatest}${catthehacker}ubuntu:full-latest\n${ubuntu2004}${catthehacker}ubuntu:full-20.04\n${ubuntu1804}${catthehacker}ubuntu:full-18.04`;
          break;
      }
      writeFileSync(actrcPath, actrc);
    }
  }
}
