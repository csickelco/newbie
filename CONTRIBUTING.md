# Contributing
Contributions to Newbie Log are welcome and greatly appreciated! Here are a few ways you can contribute:

## Ways to Contribute

### Submit Bugs or feature requests

Report bugs or request a new feature through [github issues](https://github.com/csickelco/newbie/issues)

### Fix Bugs or Implement features

Ready to contribute? Here’s how to set up newbie log for local development.

1. Fork the [newbie repo](https://github.com/csickelco/newbie) on GitHub. 
2. Clone your fork locally: ```$ git clone --branch develop git@github.com:your_name_here/newbie.git```
3. Create a branch for local development with git-flow: ```$ git-flow feature start name-of-your-bugfix-or-feature``` Or without git-flow: ```$ git checkout -b feature/name-of-your-bugfix-or-feature```
4. Now you can make your changes locally. When finished with your changes, run all unit tests with: ```TODO```
5. Commit your changes and push your branch to GitHub with git-flow:
  ```
  $ git add .
  $ git commit -m "Your detailed description of your changes."
  $ git-flow feature publish
  ```
  Or without git-flow:
  ```
  $ git add . $ git commit -m “Your detailed description of your changes.” $ git push -u origin feature/name-of-your-bugfix-or-feature
  ```
6. Submit a pull request through the GitHub website.

## Pull Request Guidelines
Before you submit a pull request, check that it meets these guidelines:

* The pull request should include tests.
* The pull request should be tied to a feature or bug (if one does not exist, please submit one through github issues)
