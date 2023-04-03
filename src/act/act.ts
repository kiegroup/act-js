import { spawn } from "child_process";
import { RunOpts, Step, Workflow } from "@aj/act/act.type";
import { ACT_BINARY } from "@aj/act/act.constants";
import { existsSync, writeFileSync, WriteStream } from "fs";
import { open } from "fs/promises";
import path from "path";
import { homedir } from "os";
import { ForwardProxy } from "@aj/proxy/proxy";
import { ArgumentMap } from "@aj/map/argument-map";
import { StepMocker } from "@aj/step-mocker/step-mocker";
import { ActionEvent } from "@aj/action-event/action-event";
import { EventJSON } from "@aj/action-event/action-event.types";
import { OutputParser } from "@aj/output-parser/output-parser";
import { ActionInput } from "@aj/action-input/action-input";

export class Act {
  private secrets: ArgumentMap;
  private cwd: string;
  private workflowFile: string;
  private env: ArgumentMap;
  private event: ActionEvent;
  private input: ActionInput;

  constructor(cwd?: string, workflowFile?: string, defaultImageSize?: string) {
    this.secrets = new ArgumentMap("-s");
    this.cwd = cwd ?? process.cwd();
    this.workflowFile = workflowFile ?? this.cwd;
    this.env = new ArgumentMap("--env");
    this.event = new ActionEvent();
    this.input = new ActionInput(this.event);
    this.setDefaultImage(defaultImageSize);
    this.setGithubStepSummary("/dev/stdout");
  }

  setCwd(cwd: string) {
    this.cwd = cwd;
    return this;
  }

  setWorkflowFile(workflowFile: string) {
    this.workflowFile = workflowFile;
    return this;
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
    this.setGithubStepSummary("/dev/stdout");
    return this;
  }

  setGithubToken(token: string) {
    this.setSecret("GITHUB_TOKEN", token);
    return this;
  }

  setGithubStepSummary(file: string) {
    this.setEnv("GITHUB_STEP_SUMMARY", file);
    return this;
  }

  setEvent(event: EventJSON) {
    this.event.event = event;
    return this;
  }

  setInput(key: string, val: string) {
    this.input.map.set(key, val);
    return this;
  }

  deleteInput(key: string) {
    this.input.map.delete(key);
    return this;
  }

  clearInput() {
    this.input.map.clear();
    return this;
  }

  /**
   * List available workflows.
   * If working directory is not specified then node's current working directory is used
   * You can also list workflows specific to an event by passing the event name
   * @param cwd
   * @param workflowFile
   * @param event
   */
  async list(
    event?: string,
    cwd: string = this.cwd,
    workflowFile: string = this.workflowFile
  ): Promise<Workflow[]> {
    const args = ["-W", workflowFile, "-l"];
    const data = await this.act(cwd, undefined, ...(event ? [event, ...args] : args));

    return data
      .split("\n")
      .slice(1, -1) // remove first (title columns) and last column
      .filter(element => element !== "" && element.split("  ").length > 1) // remove empty strings and warnings
      .map(element => {
        const splitElement = element.split("  ").filter(val => val !== ""); // remove emoty strings
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
    await this.handleStepMocking(workflow => workflow.jobId === jobId, opts);
    return this.run(["-j", jobId], opts);
  }

  async runEvent(event: string, opts?: RunOpts): Promise<Step[]> {
    await this.handleStepMocking(
      workflow => workflow.events.includes(event),
      opts
    );
    return this.run([event], opts);
  }

  async runEventAndJob(event: string, jobId: string, opts?: RunOpts): Promise<Step[]> {
    await this.handleStepMocking(
      workflow => workflow.events.includes(event) && workflow.jobId === jobId,
      opts
    );
    return this.run([event, "-j", jobId], opts);
  }

  private async handleStepMocking(
    filter: (workflow: Workflow) => boolean,
    opts?: RunOpts
  ) {
    if (opts?.mockSteps) {
      // there could multiple workflow files with same event triggers or job names. Act executes them all
      const workflowNames = (
        await this.list(undefined, opts.cwd, opts.workflowFile)
      ).filter(filter);
      return Promise.all(
        workflowNames.map(name => {
          const stepMocker = new StepMocker(
            name.workflowFile,
            opts.workflowFile ?? this.workflowFile
          );
          return stepMocker.mock(opts.mockSteps!);
        })
      );
    }
  }

  // wrapper around the act cli command
  private async act(
    cwd: string,
    logFile: string | undefined,
    ...args: string[]
  ): Promise<string> {
    const fsStream = await this.logRawOutput(logFile);
    return new Promise((resolve, reject) => {
      // do not use spawnSync. will cause a deadlock when used with proxy settings
      const childProcess = spawn(ACT_BINARY, ["-W", cwd, ...args], { cwd });
      let data = "";

      childProcess.stdout.on("data", chunk => {
        const output = chunk.toString();
        data += output;
        fsStream?.write(output);
      });

      childProcess.stderr.on("data", chunk => {
        const output = chunk.toString();
        data += output;
        fsStream?.write(output);
      });

      childProcess.on("close", code => {
        fsStream?.close();
        if (
          code === null ||
          /Cannot connect to the Docker daemon at .+/.test(data)
        ) {
          reject(data);
        } else {
          resolve(data);
        }
      });
    });
  }

  private async parseRunOpts(opts?: RunOpts) {
    let proxy: ForwardProxy | undefined = undefined;
    const actArguments: string[] = [];
    if (opts?.mockApi) {
      proxy = new ForwardProxy(opts.mockApi);
      const address = await proxy.start();
      this.setEnv("http_proxy", `http://${address}`);
      this.setEnv("https_proxy", `http://${address}`);
      this.setEnv("HTTP_PROXY", `http://${address}`);
      this.setEnv("HTTPS_PROXY", `http://${address}`);
    }

    if (opts?.artifactServer) {
      actArguments.push(
        "--artifact-server-path",
        opts?.artifactServer.path,
        "--artifact-server-port",
        opts?.artifactServer.port
      );
    }

    if (opts?.bind) {
      actArguments.push("--bind");
    }

    const cwd = opts?.cwd ?? this.cwd;
    const workflowFile = opts?.workflowFile ?? this.workflowFile;
    actArguments.push("-W", workflowFile);

    return { cwd, proxy, actArguments };
  }

  /**
   * Run the actual act binary. Pass any necessary env or secrets formatted according to the cli's requirements
   * @param cmd
   * @param opts
   * @returns
   */
  private async run(cmd: string[], opts?: RunOpts): Promise<Step[]> {
    const { cwd, actArguments, proxy } = await this.parseRunOpts(opts);
    const env = this.env.toActArguments();
    const secrets = this.secrets.toActArguments();
    const input = this.input.toActArguments();
    const event = await this.event.toActArguments();

    const data = await this.act(
      cwd,
      opts?.logFile,
      ...cmd,
      ...secrets,
      ...env,
      ...input,
      ...event,
      ...actArguments
    );

    const promises = [
      this.event.removeEvent(),
      ...(proxy ? [proxy.stop()] : [])
    ];

    const result = new OutputParser(data).parseOutput();
    await Promise.all(promises);
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

  private async logRawOutput(logFile?: string): Promise<WriteStream | undefined> {
    if (logFile) {
      const filehandle = await open(logFile, "w");
      return filehandle.createWriteStream();
    }
  }
}
