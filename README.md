# act-js

Installs [nektos/act](https://github.com/nektos/act) as a node module. Uses the medium image as the default image.

## Prerequistes

`act-js` depends on docker to run workflows.

If you are using macOS, please be sure to follow the steps outlined in [Docker Docs for how to install Docker Desktop for Mac](https://docs.docker.com/docker-for-mac/install/).

If you are using Windows, please follow steps for [installing Docker Desktop on Windows](https://docs.docker.com/docker-for-windows/install/).

If you are using Linux, you will need to [install Docker Engine](https://docs.docker.com/engine/install/).

`act-js` is currently not supported with podman or other container backends (it might work, but it's not guaranteed). Please see [nektos/act #303](https://github.com/nektos/act/issues/303) for updates.

## Configuration

In you first run with `act-js` you will have to configure it.
Please refer to [nektos/act configuration](https://github.com/nektos/act/#configuration)

## Usage

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

## Version

Each version of `act-js` corresponds to the same version of `nektos/act`