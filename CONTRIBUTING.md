# Contributing

When contributing to this repository, please first discuss the change you wish to make via an [issue](https://github.com/kiegroup/act-js/issues). You can optionally even start a [discussion](https://github.com/kiegroup/act-js/discussions).

## Prerequistes

- [Install docker](https://docs.docker.com/get-docker/)
- Node 16

## Pull Request Process

1. Fork this repository and clone your fork
2. Create a feature branch
3. Run `npm i`. This installs all dependencies including [nektos/act](https://github.com/nektos/act) which is non-nodejs dependency.
3. Make your changes and commit :)
4. Push to your branch on Github
5. Create a new pull request

## Testing

If you are making changes to the source code, then you can run the following to test your changes:
```shell
# Runs all the tests without code coverage
npm test
```
or
```shell
# Runs all the tests with code coverage
npm run test:report
```

If you are making changes to the github action workflows in this repository, then you can run the following to test your changes:
```
npm run test:ci
```

## Code Standards

To ensure that the formatting of your code is consistent, we have a pre-commit hook which will automatically fix any linting issues in all your staged files whenever your run `git commit`. Alternatively, you can run `npm run lint` to manually review formatting issues.

### Note:
- This library depends heavily on 2 upstream repositories - [nektos/act](https://github.com/nektos/act) and [kiegroup/mock-github](https://github.com/kiegroup/mock-github). So for some features/bug fixes you might have to contribute directly to these repositories

