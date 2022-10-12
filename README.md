# SDK Security Audit
## Setup
To set up and use the SDK you need to have node js installed on your machine. You will need to have also installed typescript and tsd.
The following command will install typescript globally for you:

`npm install -g typescript`

Open up the folder using node.js.
To install the security audit you should type the command:

`npm install`

This is will install the security audit and all the relevant dependencies.

To connect it to your project you need to change the following constants in the `script.ts`

`var appId = "{{appID}}";`


## Use the audit generator
Once the node packages are installed type:
`tsc`
to compile the audit generator code.

Then after compiled type:
`node script.js`

This will start running the script. Once the script has completed you will have an excel file named Mendix Security Document.