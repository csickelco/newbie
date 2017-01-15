## Synopsis

newbie is a newborn and infant tracking application for the Amazon Echo. It allows users to record feeds, diaper changes, sleep, and other information that's helpful to have at the pediatrician's office and for your own records.

## Code Structure

newbie is a Node.js application. index.js is the main file and contains the newbie Skill, with a number of intents that map to different Alexa commands. 

The rest of the newbie code is organized by feature and generally contains a "model" module, a controller for business logic, and a DAO module for data persistence. For example, the feed folder contains all code needed to add and retrieve feeds for newbie. The feed module represents data recorded for a feed (date/time, amount), while the feed_aws_dao persists feed records to DynamoDB, and feed_controller has the business logic to create and retrieve feed records using the DAO.

## Installation

### Local 

To install locally, you can run newbie inside a [Alexa app server](https://www.npmjs.com/package/alexa-app-server) instance. The alexa-app-server gives you a stand-alone web server/container to host and easily test Alexa apps locally.

**Get the alexa-app-server**

1. Pull down the alexa-app-server GitHub repo with the following command: ```git clone https://github.com/matt-kruse/alexa-app-server.git ``` 
2. Once cloned, install any required dependencies by running: ```npm install```

**Install newbie in the alexa-app-server**

1. Navigate to the alexa-app-server/examples/apps directory inside the alexa-app-server code you just installed.
2. Run the following command to pull down the newbie code into that directory: ```git clone https://github.com/csickelco/newbie.git``` 
3. Inside the newbie directory, install all required dependencies by running: ```npm install``` 
4. Navigate to the alexa-app-server/examples directory.
5. Start the alexa-app-server by running the command: ```node server```
You should see output like: ```
Serving static content from: public_html
Loading server-side modules from: server
   Loaded ~/alexa-app-server/examples/server/login.js
Loading apps from: apps
   Loaded app [hello_world] at endpoint: /alexa/helloworld
   Loaded app [newbie] at endpoint: /alexa/newbie
   Loaded app [number_guessing_game] at endpoint: /alexa/guessinggame```
6. Visit http://localhost:8080/alexa/newbie to test out the application. 
7. You can simulate different commands by selecting them from the intents dropdown. For example, the
addBabyIntent is the intent called when you say "Add Baby" to Alexa. The slots shown are the different
variables/placeholders the alexa command will accept. Once you select the intent and populate any
needed slot values, click Send request. Here are some sample values you can provide for the add baby request - sex: girl, name: Elizabeth, birthdate: 2016-06-01. You will see the response Alexa generates under the response section.

For more details, see the [Big Nerd Ranch Series: Developing Alexa Skills Locally with Node.js](https://developer.amazon.com/public/community/post/Tx1BIPOTYRL82PV/Big-Nerd-Ranch-Series-Developing-Alexa-Skills-Locally-with-Node-js-Implementing)

### Running Unit Tests
Tests are run using mocha. To install mocha, run:
```npm install mocha -g```

To run the tests, execute the following from the root of the project:
```mocha test --recursive --watch --timeout 10000``` from the root of the project. 

### Deploy to staging

To test the app on an Alexa-enabled device, see Big Nerd Ranch's Tutorial at https://developer.amazon.com/public/community/post/Tx3LNNP6YRGM176/Big-Nerd-Ranch-Series-Developing-Alexa-Skills-Locally-with-Node-js-Submitting-an. Follow the steps, except for when configuring the Lambda function, specify:
Name: newbieService
Runtime: Node.js 4.3

## Contributors

See the [Contributing instructions](CONTRIBUTING.md)

## License

Copyright 2016 Christina Sickelco

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
