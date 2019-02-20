# SDK Security Audit
## Setup
To set up and use the sdk you need to have node js installed on your machine. You will need to have also installed typescript and tsd.
The following command will install typescript and tsd globally for you:

`npm install -g typescript tsd`

Open up the folder using node.js.
To install the security audit you should type the command:

`npm install`

This is will install the security audit and all the relevant dependencies.

To connect it to your project you need to change the following constants in the `script.ts`

`var username = "{{Username}}";`

`var apikey = "{{ApiKey}}";`

`var projectId = "{{ProjectId}}";`

`var projectName = "{{ProjectName}}";`

API keys can be found in the mendix home portal.

## Use the audit generator
Once the node packages are installed type:
`tsc`
to compile the audit generator code.

Then after compiled type:
`node script.js`

This will start running the script. Once the script has completed you will have an excel file named Mendix Security Document.