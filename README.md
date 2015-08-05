Clinical Genomics Web App
==========

Web application for clinical pharmacogenomic interpretation.

## Description
Clinical Pharmacogenetics is a new and growing field with large implications for patient care. As genetic information becomes more readily available, the software used to interpret it must also become more broadly accesible and reliable for a wide range of client usage. GenomeClinic-PGX attempts to address the issues posed by having a diverse user group by providing an easy to use interface for data entry and report generation. GenomeClinic-PGX takes information on genetic variation in the form of VCF files or a custom file format described [here](docs/custom_format.md) and performs a pharmacogenetic analysis on a specified set of variants. The results from this analysis are then used to provide a detailed and customizable report containing drug recommendations and a genetic profile of the patient for use by the clinicians.

The GenomeClinic-PGX web server is built in [Node.js](http://nodejs.org) as an [express](http://expressjs.com/) application. It uses mongo is used for back end storage of all information, including the session data store. The design of the dabatase can be found [here](docs/database_design.md). On the client side the app employs the [Handlebars.js](http://handlebarsjs.com/) templating engine in combination with [Jquery](http://jquery.com) and native javascript in order to produce dynamic and responsive page content that gives a fluid feeling to the web interface. In addition, [Foundation 5](http://foundation.zurb.com) is used as a comprehensive front end framework that enables fast, rapid prototpying of new page content.

Reports are the cornerstone of the app and are generated in PDF format with the use of [PhantomJS](http://phantomjs.org). Any custom template can be designed and used for the final report quite easily using a handlebars template.

## Downloading

To get the stable reslease version of GenomeClinic-PGX, clone the github repository via: 

`git clone https://github.com/BaderLab/GenomeClinic-PGX.git`

For the most recent development version you can `git --checkout dev`


## Build Dependencies 

Install the dependencies and then run `npm install` to build the required node.js libraries.
- [Node.js](http://nodejs.org/) >= 0.10.0 
- [MongoDB](http://mongodb.org/downloads) >= 3.0.0
- [PhantomJS](http://phantomjs.org/) >= 1.9.8

## Build instructions

Once installed run `gulp` from the console. By default gulp is not installed globally but can be found in the `node_modules/.bin/gulp`. You can Select from the following options.

##### Building:
- `default` : create the final `build` directory.
- `watch` : create the `build` directory and watch for any changes to source files, updating them they need be.
- `clean` : clean the `build` directory


## Usage

The server can be started from the command line as a node application. By default the server runs on port 80 for http traffic and port 443 for https traffic. In some configurations these ports may be closed and require sudo/administrator accesss when the server is started.

#### Basic usage

Starting the server is simple. From the commandline in the build directory type:

```js
node webapp.js
```

#### Advanced usage

There are multiple configurable settings that can be specified from the commandline at startup. The user has the option of enabling or disabling various authentication routes by passing certain flags from the commandline. By default new users are able to signup from the web-interface as well as recover their password. In order for the password recovery to work an email and accurate credentials must be supplied by the admin at server startup.

- Disable Signup: `--nosignup`
- Disbale Password Recovery: `--norecover`

example

```js
node webapp.js --nosignup --norecover
```

Additionally In order to set up Google OAUTH requires registering with google and supplying the api-keys that they provide in the `api.js` file
- Enable Google O-Auth: `--oauth

##### Database settings

By default the server will attempt to connect to a mongodb instance running on the `localhost` on port `27017`. However this can be modified from the commandline to connect to a remote mongodb server. Password Authentication is not currently provided.
	
- Set Mongodb Host Path : `--mongodb-host [address Default: localhost]`
- Set Mongodb Port Number : `--mongodb-port [number Default: 27017]`
- Set Mongodb Database : `--mongodb-db [ databse Default: webappDB ]`

example :

```js
node webapp.js --mongodb-host [remote host address] --mongodb-port [ remote port address ]
```

##### Setting up HTTPS

By default the server routes all traffic through HTTP, however it can be configured to run as an HTTPS server so long as the user supplies a valid certificate and key. Additionally, the user can specify a custom https or http port number.
	
- Turn on HTTPS usage : `--https`
- SSL key : `--key [ path to key ]`
- SSL Certificate : `--crt [path to certificate]`
- Change the https port : `--httpsport [ port Default: 443 ]`
- Change the http port : `--httpport [ port Default: 80]`


example:

```js
node webapp.js --https --crt ../path/to/cert.crt --key ../path/to/key.key
```

## Generating Reports

GenomeClinic-PGX uses [Handlebars.js](www.handlebarsjs.com) to dynamically generate downloadable reports for the users. CA data Object from the report page  is passed to handlebars containing all fo the patient information as well as the data inputed by the user. A generic report is included with the app by default, however it can easily be changed and updated to have a custom report by creating a new template by following the parameters listed [here](docs/report_reference.md). To direct the app to use a new template you can pass the path of the template via an argument on the commandline. The file must be a handlebars template with the extension `.hbs`. We suggest that all resources referenced in the hbs file are referenced with an absolute path.

- Change report : `--report [ report name ]`

exmaple:
```js
node webapp.js --report ../path/to/report.hbs
```


## Default Data

The first time the server starts, it will search in the build directory for the default JSON data to add to the database. The user can provide a path to new default data that can be uploaded during the first time the server is started. The data must follow a specific format that is documented [here](docs/default_data.md). The data can only be uploaded the first time the server is started, otherwise in order to perform any sort of bulk operation the user must use the [bulkops.js](docs/bulkops.md) application to perform the action.

- Change default data : `--def-data [data Default: lib/conf/default_rec_data.json]`

example:
```js
node webapp.js --def-data ../path/to/data.json
```
