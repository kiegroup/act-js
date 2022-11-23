# act-js

Installs [nektos/act](https://github.com/nektos/act) and provides access to it as a CLI as well as an API

## Table of Content

- [Prerequistes](#prerequistes)
- [Configuration](#configuration)
- [CLI Usage](#cli-usage)
- [API Usage](#api-usage)
  - [Current working directory](#current-working-directory)
  - [Secrets](#secrets)
  - [Env](#env)
  - [List workflows](#list-workflows)
  - [Run a job](#run-a-job)
    - [Using job id](#using-job-id)
    - [Using event name](#using-event-name)
    - [Mocking apis during the run](#mocking-apis-during-the-run)
    - [Mocking steps](#mocking-steps)
    - [Run result](#run-result)
- [Example with Mock Github](#example-with-mock-github)
- [Limitations](#limitations)
- [Version](#version)

## Prerequistes

`act-js` depends on docker to run workflows.

If you are using macOS, please be sure to follow the steps outlined in [Docker Docs for how to install Docker Desktop for Mac](https://docs.docker.com/docker-for-mac/install/).

If you are using Windows, please follow steps for [installing Docker Desktop on Windows](https://docs.docker.com/docker-for-windows/install/).

If you are using Linux, you will need to [install Docker Engine](https://docs.docker.com/engine/install/).

`act-js` is currently not supported with podman or other container backends (it might work, but it's not guaranteed). Please see [nektos/act #303](https://github.com/nektos/act/issues/303) for updates.

## Configuration

In you first run with `act-js` as a CLI you will have to configure it.
Please refer to [nektos/act configuration](https://github.com/nektos/act/#configuration)

This does not apply when you are using it as a programmable interface.

## CLI Usage

Use locally with npm scripts

```
npm i act-js
npx act-js --version
```

Use globally

```
npm i -g act-js
act-js --version
```

For detailed usage on how you can use `act-js` please refer to [nektos/act](https://github.com/nektos/act)

## API Usage

Provides an interface for the [nektos/act](https://github.com/nektos/act/) tool to execute it programmatically. By default it uses the `act` executable that comes with the package. However, if you want to use a different executable you can do so by setting the env variable `ACT_BINARY` to point to the location of the executable you want to use. 

### Current working directory

You can set the current working directory. This directory is from where `act` will read the workflow files from. Setting a current working directory is equivalent to calling `act` with `-W /path/to/cwd` option in the `/path/to/cwd` directory for any subsequent call. By default, the root of the current project is used as the current working directory.

```typescript
// define it during construction
const act = new Act("path/to/directory/that/contains/workflowfile");

// use the default current working directory
act = new Act();

// Set the current working directory after initialization
act.setCwd("path/to/directory/that/contains/workflow");
```

### Secrets

You can define, delete and clear secrets that will be used by `act` when you execute a run.

```typescript
let act = new Act();

// setSecret returns back the object
act = act.setSecret("secret1", "value1");

// you can chain your setSecrets
act
  .setSecret("secret1", "value1")
  .setSecret("secret2", "value2")
  .setSecret("secret3", "value3");

// you can delete a secret
act.deleteSecret("secret1");

// you clear all the secrets that you had previously defined
act.clearSecret();
```

### Env

You can define, delete and clear env variables that will be used by `act` when you execute a run.

```typescript
let act = new Act();

// setEnv returns back the object
act = act.setEnv("env1", "value1");

// you can chain your setEnvs
act.setEnv("env1", "value1").setEnv("env2", "value2").setEnv("env3", "value3");

// you can delete a Env
act.deleteEnv("env1");

// you clear all the envs that you had previously defined
act.clearEnv();
```

### List workflows

You can list all the workflows in the current working directory.

```typescript
const act = new Act();

await act.list();
```

Or you can list workflows for a specific event in the current working directory.

```typescript
const act = new Act();

// lists all workflows which are triggered due to a pull request event
await act.list("pull_request");
```

`list` returns an array of `Workflow` objects as defined below

```typescript
[
  {
    jobId: "job id as defined in the workflow",
    jobName: "job name as defined in the workflow",
    workflowName: "name of the workflow",
    workflowFile: "the name of the workflow file",
    events: "event that triggers this workflow",
  },
];
```

### Run a job

When running a job (which ever way), you can optionally pass run options

```typescript
{
  cwd?: string, // overrides the global cwd and uses the one passed in options
  // activates the artifact server
  artifactServer?: {
    path: string; // where to store the uploaded artifacts
    port: string; // where to run the artifact server
  };
  mockApi: ResponseMocker[]; // specify the apis you want to mock. ResponseMocker is from mock-github
}
```

#### Using job id

You can execute a job using a job id. Equivalent of running `act -j job_id`.

It returns an array of `Step` outputs. Described [below](#run-result)

```typescript
const act = new Act();

let result = await act.runJob("job_id");

/**
 * This will pass your secrets to act
 * Equivalent to running: act -j job_id -s secret1=value1 -s secret2=value2
 */
result = await act
  .secret("secret1", "value1")
  .secret("secret2", "value2")
  .runJob("job_id");
```

#### Using event name

You can trigger a workflow using an event name. Equivalent of running `act event_name`.

It returns an array of `Job` outputs. Described [below](#run-result)

```typescript
const act = new Act();

let result = await act.runEvent("pull_request");

/**
 * This will pass your secrets to act
 * Equivalent to running: act pull_request -s secret1=value1 -s secret2=value2
 */
result = await act
  .secret("secret1", "value1")
  .secret("secret2", "value2")
  .runJob("pull_request");
```

#### Mocking apis during the run

You can use [Mockapi](https://github.com/kiegroup/mock-github#mockapi) and [Moctokit](https://github.com/kiegroup/mock-github#moctokit) to mock any kind of HTTP and HTTPS requests during your workflow run provided that the client being used honours HTTP_PROXY and HTTPS_PROXY env variables. Depending on the client, for HTTPS they might issue a CONNECT request to open a secure TCP tunnel. In this case `Act` won't be able to mock the HTTPS request.
(Note - For Octokit, you can mock HTTPS requests because it does not issues a CONNECT request)

```typescript
import { Moctokit, Mockapi } from "@kie/mock-github";
const moctokit = new Moctokit();
const mockapi = new Mockapi({
  customApi: {
    baseUrl: "http://custom-api.com",
    endpoints: {
      root: {
        search: {
          path: "/",
          method: "get",
          parameters: {
            query: [],
            path: [],
            body: [],
          },
        },
      },
    },
  },
});
const act = new Act();

let result = await act.runEvent("pull_request", {
  mockApi: [
    // mock a call to github api to get repo name
    moctokit.rest.repos
      .get()
      .setResponse({ status: 200, data: { full_name: "kiegroup/act-js" } }),
    // mock a call to some custom api
    mockapi.mock.customApi.root
      .search()
      .setResponse({ status: 200, data: { msg: "found" } }),
  ],
});
```

#### Mocking steps

There are cases where some of the steps have to be directly skipped or mocked because it is not feasible to execute them in a test env and might even be redundant to test them (npm publish for instance), so `mockSteps` mechanism is provided to overcome those cases.

Let's suppose this is the workflow to test

```yaml
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 14
          registry-url: https://registry.npmjs.org/
      - run: npm install
      - run: npm run build
      - name: publish step
        run: npm publish --access public
          env:
            NODE_AUTH_TOKEN: ${{secrets.NPM_TOKEN}}
```

The two final steps has to be skipped since the package shouldn't be really published (and most probably it will fail due to NPM_TOKEN or already existing version on the registry). In order to do skip or mock this step we can do the following while running the workflow

```typescript
const act = new Act();
let result = await act.runJob("job_id", {
  mockSteps: {
    // job name
    publish: [
      {
        name: "publish step",
        mockWith: "echo published",
      },
    ],
  },
});
```

Schema for `mockSteps`

```typescript
{
  // name of the job for which you want to mock steps
  [jobName: string]: (
    {
      name: "locates the step using the name field"
      mockWith: "command to replace the given step with"
    } |
    {
      id: "locates the step using the id field"
      mockWith: "command to replace the given step with"
    } |
    {
      uses: "locates the step using the uses field"
      mockWith: "command to replace the given step with"
    } |
    {
      run: "locates the step using the run field"
      mockWith: "command to replace the given step with"
    }
  )[]
}
```

NOTE: Please use `MockGithub` to run the workflow in a clean safe github repository so that any changes made to the Workflow file are done in the test environment and not to the actual file.

#### Run result

Each run returns an array of `Step` objects that describes what was executed, what was the output and whether it failed or not. Schema:

```typescript
[
  {
    name: "the command/step name that was executed",
    output: "output of the command",
    // 0 implies it succeeded, 1 implies it failed and -1 implies something went wrong with the interface which should be reported to us
    status: 0 | 1 | -1,
  },
];
```

## Example with Mock Github

You can use this library along with [mock-github](https://github.com/kiegroup/mock-github) to test your workflow files as well as your custom actions.
Here are some [examples](https://github.com/shubhbapna/mock-github-act-js-examples) on how to do so.

You can also take look at how the workflow files are being tested in this repository - [ci-check.yaml](.github/workflows/ci-checks.yaml)

## Limitations

Any limitations of `nektos/act` apply here as well.


## Version

The version of `nektos/act` that this library installs corresponds to the most API compatible recent version of `nektos/act`
