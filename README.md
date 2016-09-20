## Synopsis

newbie is a newborn and infant tracking application for the Amazon Echo. It allows users to record feeds, diaper changes, sleep, and other information that's helpful to have at the pediatrician's office and for your own records.

## Code Structure

newbie is a Node.js application. index.js is the main file and contains the newbie Skill, with a number of intents that map to different Alexa commands. 

The rest of the newbie code is organized by feature and generally contains a "model" module, a controller for business logic, and a DAO module for data persistence. For example, the feed folder contains all code needed to add and retrieve feeds for newbie. The feed module represents data recorded for a feed (date/time, amount), while the feed_aws_dao persists feed records to DynamoDB, and feed_controller has the business logic to create and retrieve feed records using the DAO.

## Installation

To install locally, you can run with the Alexa app server as follows:
1. Pull down the alexa-app-server GitHub repo with the following command:
```
git clone https://github.com/matt-kruse/alexa-app-server.git
``` 
2. Once cloned, install any required dependencies by running:
```
npm install
```
3. Move the folder with the newbie code into the alexa-app-server repository's './examples/apps' directory (e.g. ./examples/apps/newbie). The index.js should be at the root of the newbie folder.
4. Change to the examples directory and run:
```
node server
```
5. Visit http://localhost:8080/newbie to test out the application.

For more details, see the [Big Nerd Ranch Series: Developing Alexa Skills Locally with Node.js](https://developer.amazon.com/public/community/post/Tx1BIPOTYRL82PV/Big-Nerd-Ranch-Series-Developing-Alexa-Skills-Locally-with-Node-js-Implementing)

## Contributors

Feature requests and issues are tracked on [trello](https://trello.com/b/8m6eYU5T/newbie)

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