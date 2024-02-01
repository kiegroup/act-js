# act-js

Installs [nektos/act](https://github.com/nektos/act) and provides access to it as a CLI as well as an API

## Table of Content

- [Prerequistes](#prerequistes)
- [Configuration](#configuration)
- [CLI Usage](#cli-usage)
- [API Usage](#api-usage)
  - [Current working directory and Workflow file](#current-working-directory-and-workflow-file)
  - [Secrets](#secrets)
  - [Env](#env)
  - [Input](#input)
  - [Event payload](#event-payload)
  - [List workflows](#list-workflows)
  - [Run a job](#run-a-job)
    - [Using job id](#using-job-id)
    - [Using event name](#using-event-name)
    - [Using event name and job id](#using-event-name-and-job-id)
    - [Mocking apis during the run](#mocking-apis-during-the-run)
    - [Mocking steps](#mocking-steps)
    - [Run result](#run-result)
- [Mockapi](#mockapi)
  - [Defining a schema](#defining-a-schema)
  - [Mock an api](#mock-an-api)
    - [Mock the entire endpoint](#mock-the-entire-endpoint)
    - [Mock an endpoint for specific parameter(s)](#mock-an-endpoint-for-specific-parameters)
  - [Replying with a response](#replying-with-a-response)
    - [Reply once](#reply-once)
    - [Reply N times](#reply-n-times)
    - [Chaining responses](#chaining-responses)
  - [Typescript Support](#typescript-support)
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
npm i @kie/act-js
npx act-js --version
```

Use globally

```
npm i -g @kie/act-js
act-js --version
```

For detailed usage on how you can use `act-js` please refer to [nektos/act](https://github.com/nektos/act)

## API Usage

Provides an interface for the [nektos/act](https://github.com/nektos/act/) tool to execute it programmatically. By default it uses the `act` executable that comes with the package. However, if you want to use a different executable you can do so by setting the env variable `ACT_BINARY` to point to the location of the executable you want to use.

### Current working directory and Workflow file

You can set the current working directory as well as the location of workflow files (wrt to the cwd). The current working directory is from where `act` will be executed from. The workflow file location is the location from which `act` will try to read the workflow files from. Setting the workflow file is equivalent to calling `act` with `-W /path/to/workflows` option.

By default, if no current working directory is passed to the constructor, it is set to be `process.cwd()`.  
Similarly, by default, the workflow file location is the current working directory

### Secrets

You can define, delete and clear secrets that will be used by `act` when you execute a run.

The method `setGithubToken` is quick wrapper to set the `GITHUB_TOKEN` env variable.

```typescript
let act = new Act();

// setSecret returns back the object
act = act.setSecret("secret1", "value1");

// you can chain your setSecrets
act
  .setSecret("secret1", "value1")
  .setSecret("secret2", "value2")
  .setSecret("secret3", "value3")
  .setGithubToken("token");

// you can delete a secret
act.deleteSecret("secret1");

// you clear all the secrets that you had previously defined
act.clearSecret();
```

### Env

You can define, delete and clear env variables that will be used by `act` when you execute a run.

The method `setGithubStepSummary` is quick wrapper to set the `GITHUB_STEP_SUMMARY` env variable. By default it is set to `/dev/stdout`

```typescript
let act = new Act();

// setEnv returns back the object
act = act.setEnv("env1", "value1");

// you can chain your setEnvs
act
  .setEnv("env1", "value1")
  .setEnv("env2", "value2")
  .setEnv("env3", "value3")
  .setGithubStepSummary("/path/to/some/file");

// you can delete a Env
act.deleteEnv("env1");

// you clear all the envs that you had previously defined
act.clearEnv();
```

### Input

You can define github action input that will be used by `act` when you execute a run.

```typescript
let act = new Act();

// setInput returns back the object
act = act.setInput("input1", "value1");

// you can chain your setInputs
act
  .setInput("input1", "value1")
  .setInput("input2", "value2")
  .setInput("input3", "value3")

// you can delete an input
act.deleteInput("input1");

// you clear all the inputs that you had previously defined
act.clearInput();
```

### Event payload

You can pass an [event payload](https://docs.github.com/en/developers/webhooks-and-events/webhooks/webhook-events-and-payloads) during your workflow execution. It is equivalent to calling `act` with the `-e` flag set.

```typescript
let act = new Act();

act
  .setEvent({
    pull_request: {
      head: {
        ref: "branch",
      },
    },
  })
  .runEvent("pull_request");
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
  cwd?: string;               // overrides the global cwd and uses the one passed in options
  workflowFile?: string;      // overrides the global workflow file path and uses the one passed in options
  bind?: boolean;             // bind the cwd instead of copying it during workflow execution
  artifactServer?: {          // activates the artifact server
    path: string;             // where to store the uploaded artifacts
    port: string;             // where to run the artifact server
  };
  mockApi: ResponseMocker[];  // specify the apis you want to mock. ResponseMocker is from mock-github
  mockSteps: MockStep;        // specify which steps you want to mock
  logFile?: string;           // write the raw output act produces to this file for debugging purposes
  verbose?: true;             // enable versbose logging
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

#### Using event name and job id

You can trigger a workflow using an event name and job id. Equivalent of running `act event_name -j job_id`.

It returns an array of `Job` outputs. Described [below](#run-result)

```typescript
const act = new Act();

let result = await act.runEventAndJob("pull_request", "jobId");
```

#### Mocking apis during the run

You can use [Mockapi](#mockapi) and [Moctokit](https://github.com/kiegroup/mock-github#moctokit) to mock any kind of HTTP and HTTPS requests during your workflow run provided that the client being used honors HTTP_PROXY and HTTPS_PROXY env variables. 

> [!Note]  
> `Act` won't be able to mock HTTPS requests if the client sends a CONNECT request to establish a secure TCP tunnel. So depending on the client, `Act` may or may not be able to mock HTTPS requests see [#52](https://github.com/kiegroup/act-js/issues/52)

```typescript
import { Moctokit } from "@kie/mock-github";
import { Mockapi } from "@kie/act-js";
const moctokit = new Moctokit("http://api.github.com");
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

For testing actions which use `Octokit`, you will need to make sure that `Octokit` instance is configured to use proxies. You can do so by using [ProxyAgent](https://github.com/octokit/octokit.js#proxy-servers-nodejs-only) or using the hydrated `Octokit` instance from [@actions/github](https://github.com/actions/toolkit/tree/main/packages/github).

Examples to help you get started:
- [Using ProxyAgent with Octokit](https://github.com/shubhbapna/mock-github-act-js-examples/tree/main/custom-actions/javascript)
- [Testing @actions/github-script which uses @actions/github internally](https://github.com/shubhbapna/mock-github-act-js-examples/tree/main/workflow/github-script)

#### Mocking steps

There are cases where some of the steps have to be skipped or mocked because it is not feasible to execute them in a test env and might even be redundant to test them (npm publish for instance). In such cases, we can use the `mockSteps` option when executing `act`.

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

Now while testing this, we probably don't want to actually publish a package, so we will use `mockSteps` to change the `npm publish --access public` command to something else. Moreover, say the registry url was behind a vpn and not really accessible locally. We can change this registry url as well using `mockSteps`. In particular, for any step you can replace it with any new step you want. The new step doesn't override the old step completely, it just updates the values that are defined in the new step. To delete a particular field, you will have to set it to `undefined` when passing the new step to `mockSteps`.

```typescript
const act = new Act();
let result = await act.runJob("job_id", {
  mockSteps: {
    // job name
    publish: [
      {
        uses: "actions/setup-node@v3",
        mockWith: {
          with: {
            "registry-url": "local-regsitry"
          }
        }
      },
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
      mockWith: "command or a new step as JSON to replace the given step with"
    } |
    {
      id: "locates the step using the id field"
      mockWith: "command or a new step as JSON to replace the given step with"
    } |
    {
      uses: "locates the step using the uses field"
      mockWith: "command or a new step as JSON to replace the given step with"
    } |
    {
      run: "locates the step using the run field"
      mockWith: "command or a new step as JSON to replace the given step with"
    } |
    {
      index: "locates the step using the index (0 indexed) in the steps array of the workflow"
      mockWith: "command or a new step as JSON to replace the given step with"
    } |
    {
      before: "index of the step or the id/name/run/uses of the step before which you want to insert a step"
      mockWith: "a new step as JSON to be added before the given step"
    } |
    {
      after: "index of the step or the id/name/run/uses of the step after which you want to insert a step"
      mockWith: "a new step as JSON to be added after the given step"
    }
  )[]
}
```

**Important Notes**: 
- Please use `MockGithub` to run the workflow in a clean safe github repository so that any changes made to the Workflow file are done in the test environment and not to the actual file.

#### Run result

Each run returns an array of `Step` objects that describes what was executed, what was the output and whether it failed or not. Schema:

```typescript
[
  {
    name: "the command/step name that was executed",
    output: "output of the command",
    // 0 implies it succeeded, 1 implies it failed and -1 implies something went wrong with the interface which should be reported to us
    status: 0 | 1 | -1,
    groups?: {name: string, output: string}[] // output grouped by annotations if there were any
  },
];
```

## Mockapi

> [!WARNING]  
> Mocking of apis is currently not compatible with Node 18's native `fetch` implementation since it uses `nock` under the hood See [nock/nock#2397](https://github.com/nock/nock/issues/2397)

Provides a simple interface to mock any api schema that you define.

### Defining a schema

You need a define an api schema for this class and it will automatically construct mockers for all the endpoints you define.

You can directly pass the schema during initialization

```typescript
const mockapi = new Mockapi({
  google: {
    baseUrl: "https://google.com",
    endpoints: {
      root: {
        get: {
          path: "/",
          method: "get",
          parameters: {
            path: [],
            query: ["logo"],
            body: [],
          },
        },
      },
    },
  },
});
```

Or you can pass a path to a JSON file containing the schema

```typescript
const mockapi = new Mockapi("/path/to/json");
```

Schema Description

```typescript
{
  [name_of_api: string]: {
    baseUrl: "the the base url for the api",
    // different routes for the base url that are available
    endpoints: {
      // You can group similar api's together. For example all api's related to repositories can be grouped together
      [scope: string]: {
        // name for the actual endpoint
        [endpoint_name: string]: {
          // path for the endpoint. You can define path parameters by putting them in between curly braces. Below is an example where "params" is a path paramter
          path: "/path/to/api/with/{params}/and/more",
          method: "get" | "post" | "put" | "patch" | "delete",
          paramters: {
            // any path parameters defined in the path need to be included in this array. Note that the name of paramter must match in the path
            path: ["params"],
            // you can defined any url queries
            query: ["query"],
            // you can define any request body fields here
            body: ["body"],
          }
        }
      }
    }
  },
  // you can define multiple APIs like above
}
```

### Mock an api

The api(s) from the schema can simple be mocked as `mock.[api_name].[scope_name].[method_name](parms)`

#### Mock the entire endpoint

You can mock an entire endpoint by simply passing no arguments.

```typescript
const mockapi = new Mockapi({
  google: {
    baseUrl: "https://google.com",
    endpoints: {
      root: {
        get: {
          path: "/{search}",
          method: "get",
          parameters: {
            path: ["search"],
            query: ["logo"],
            body: [],
          },
        },
      },
    },
  },
  {
    amazon: {
      baseUrl: "https://amazon.com",
      endpoints: {
        items: {
          updateItem: {
            path: "/update/{itemId}",
            method: "post",
            paramters: {
              path: ["itemId"],
              query: [],
              body: ["name", "description"]
            }
          }
        }
      }
    }
  }
});
/**
 * This translates to mocking all possible values of path, query and body paramters
 * mentioned in the schema for "https://google.com/{search}"
 */
mockapi.mock.google.root
  .get()
  .reply({ status: 200, data: { message: "found" } });

/**
 * This translates to mocking all possible values of path, query and body paramters
 * mentioned in the schema for "https://amazon.com/update/{itemId}"
 */
mockapi.mock.amazon.items
  .updateItem()
  .reply({ status: 201, data: { message: "posted" } });

// this will throw an error since there was no ibm api defined in the schema
mockapi.mock.ibm.root.get().reply({status: 201, data: { message: "posted" }})
```

#### Mock an endpoint for specific parameter(s)

You can mock an endpoint for certain paramters. So only if the call to the api has parameters which match the values you defined, it will be get the mocked response.

```typescript
const mockapi = new Mockapi({
  google: {
    baseUrl: "https://google.com",
    endpoints: {
      root: {
        get: {
          path: "/{search}",
          method: "get",
          parameters: {
            path: ["search"],
            query: ["logo"],
            body: [],
          },
        },
      },
    },
  },
  {
    amazon: {
      baseUrl: "https://amazon.com",
      endpoints: {
        items: {
          updateItem: {
            path: "/update/{itemId}",
            method: "post",
            paramters: {
              path: ["itemId"],
              query: [],
              body: ["name", "description"]
            }
          }
        }
      }
    }
  }
});
/**
 * This translates to mocking "https://google.com/football?logo='football.png'" and
 * "https://google.com/football?logo='football.jpeg'" only
 */
mockapi.mock.google.root
  .get({search: "football", logo: /football\.(png|jpeg)/})
  .reply({ status: 200, data: { message: "found" } });

/**
 * This translates to mocking an api call to "https://amazon.com/update/20" with a
 * request body where "name" is "book" and description starts with "This is book is"
 */
mockapi.mock.amazon.items
  .updateItem({itemId: 20, name: "book", description: /This is book is .+/})
  .reply({ status: 201, data: { message: "posted" } });
```

### Replying with a response

The endpoint isn't actually mocked with calling `reply` with response you want send back if your application makes an api call to that particular endpoint.

#### Reply once

You can reply with a response exactly once i.e. the 1st api call to the mocked endpoint will respond with whatever response you set and the 2nd api call won't be mocked.

```typescript
const mockapi = new Mockapi({
  google: {
    baseUrl: "https://google.com",
    endpoints: {
      root: {
        get: {
          path: "/{search}",
          method: "get",
          parameters: {
            path: ["search"],
            query: ["logo"],
            body: [],
          },
        },
      },
    },
  },
});

/**
 * Responds with status 200 and data { message: "message" } exactly once
 */
mockapi.mock.google.root
  .get()
  .reply({ status: 200, data: { message: "message" } });
```

#### Reply N times

You can repeat the same response n times i.e. n consecutive calls to the mocked api will get the same response back

```typescript
const mockapi = new Mockapi({
  google: {
    baseUrl: "https://google.com",
    endpoints: {
      root: {
        get: {
          path: "/{search}",
          method: "get",
          parameters: {
            path: ["search"],
            query: ["logo"],
            body: [],
          },
        },
      },
    },
  }
});

/**
 * Responds with status 200 and data { message: "message" } for exactly 5 consecutive api calls
 */
mockapi.mock.google.root
  .get()
  .reply({ status: 200, data: { message: "message" } }, repeat: 5);
```

#### Setting response and replying later

You can set an array of responses but actually mock the api later on. Responses are sent in order of their position in the array. This is extremely useful when using moctokit with [Action Compiler](#action-compiler)

```typescript
const mockapi = new Mockapi({
  google: {
    baseUrl: "https://google.com",
    endpoints: {
      root: {
        get: {
          path: "/{search}",
          method: "get",
          parameters: {
            path: ["search"],
            query: ["logo"],
            body: [],
          },
        },
      },
    },
  }
});

/**
 * Add just 1 response to an array of responses but don't actually mock the endpoint
 */
const mockedGoogle = mockapi.mock.google.root.get()
                                             .setResponse({
                                                status: 200,
                                                data: {message: "message"}, repeat: 5
                                              });

/**
 * Adds all of these responses after the above response in the array. Again doesn't actually mock the api
 */
mockedGoogle.setResponse([
  {status: 201, data: {message: "something"}},
  {status: 400, data: {message: "something else"}, repeat: 2}
  {status: 404, data: {message: "something completely difference"}}
]);

/**
 * Now the api is actually being mocked.
 * For the 1st, 2nd, 3rd, 4th and 5th api call the response status would be 200
 * For the 6th api call the response status would be 201
 * For the 7th and 8th api call the response status would be 400
 * For the 9th api call the response status would be 404
 */
mockedGoogle.reply();
```

#### Chaining responses

You can chain multiple responses together

```typescript
const mockapi = new Mockapi({
  google: {
    baseUrl: "https://google.com",
    endpoints: {
      root: {
        get: {
          path: "/{search}",
          method: "get",
          parameters: {
            path: ["search"],
            query: ["logo"],
            body: [],
          },
        },
      },
    },
  },
});

/**
 * For the 1st, 2nd, 3rd, 4th and 5th api call the response status would be 200
 * For the 6th api call the response status would be 201
 * For the 7th and 8th api call the response status would be 400
 * For the 9th api call the response status would be 404
 */
mockapi.mock.google.root
  .get()
  .reply({
    status: 200,
    data: { owner_url: "whatever url" },
    repeat: 5,
  })
  .setResponse([
    { status: 201, data: { owner_url: "something" } },
    { status: 400, data: { owner_url: "something else" }, repeat: 2 },
  ])
  .reply()
  .reply({
    status: 404,
    data: { owner_url: "something completely difference" },
  });
```

### Typescript Support

Since the endpoint mockers are generated dynamically based on the api schema, typescript won't be able to enfource datatype checks like it does for [Moctokit](https://github.com/kiegroup/mock-github#moctokit)

## Example with Mock Github

You can use this library along with [mock-github](https://github.com/kiegroup/mock-github) to test your workflow files as well as your custom actions.
Here are some [examples](https://github.com/shubhbapna/mock-github-act-js-examples) on how to do so.

You can also take look at the following:
 - Testing workflow files in this repository - [ci-check.yaml](.github/workflows/ci-checks.yaml)
 - End to end tests for a custom github action - [build-chain](https://github.com/kiegroup/github-action-build-chain/tree/main/test/e2e)

## Limitations

Any limitations of `nektos/act` apply here as well.

## Version

The version of `nektos/act` that this library installs corresponds to the most API compatible recent version of `nektos/act`
